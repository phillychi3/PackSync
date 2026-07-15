import { db } from '$lib/server/db'
import { notificationPreference, pushSubscription, tripMember } from '$lib/server/db/schema'
import { sendWebPush, webPushConfigured } from '$lib/server/push'
import { eq, inArray } from 'drizzle-orm'

type PushPayload = { title: string; body: string; url?: string }
type Options = {
	excludeUserId?: string
	onlyUserIds?: string[]
	respectBillPref?: boolean
}

/** Sends an event push to trip members. Never throws — event pushes must not break the main request. */
export async function pushToTripMembers(tripId: string, payload: PushPayload, options?: Options) {
	if (!webPushConfigured) return
	try {
		const members = await db.query.tripMember.findMany({
			where: eq(tripMember.tripId, tripId)
		})
		let userIds = members
			.map((member) => member.userId)
			.filter((id) => id !== options?.excludeUserId)
		if (options?.onlyUserIds) {
			userIds = userIds.filter((id) => options.onlyUserIds!.includes(id))
		}
		if (userIds.length === 0) return

		if (options?.respectBillPref) {
			const prefs = await db.query.notificationPreference.findMany({
				where: inArray(notificationPreference.userId, userIds)
			})
			const disabled = new Set(prefs.filter((pref) => !pref.remindBills).map((p) => p.userId))
			userIds = userIds.filter((id) => !disabled.has(id))
			if (userIds.length === 0) return
		}

		const subs = await db.query.pushSubscription.findMany({
			where: inArray(pushSubscription.userId, userIds)
		})
		await Promise.all(
			subs.map(async (sub) => {
				try {
					await sendWebPush(sub, payload)
				} catch (err) {
					const statusCode = (err as { statusCode?: number }).statusCode
					if (statusCode === 404 || statusCode === 410) {
						await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id))
					}
				}
			})
		)
	} catch {
		// push failures are non-fatal
	}
}
