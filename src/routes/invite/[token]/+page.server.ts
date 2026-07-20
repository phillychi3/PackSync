import { fail } from '@sveltejs/kit'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { invitation, tripMember } from '$lib/server/db/schema'
import type { Actions, PageServerLoad } from './$types'

type InviteState = 'ready' | 'login_required' | 'not_found' | 'expired' | 'exhausted' | 'already_member'

async function getInvitation(token: string) {
	return db.query.invitation.findFirst({
		where: eq(invitation.token, token),
		with: { trip: true }
	})
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const inv = await getInvitation(params.token)

	if (!inv) {
		return {
			state: 'not_found' satisfies InviteState,
			message: '找不到這個邀請連結。'
		}
	}

	if (!locals.user) {
		return {
			state: 'login_required' satisfies InviteState,
			message: '請先登入，登入後再回到這個邀請連結加入旅程。',
			loginUrl: `/login?redirectTo=${encodeURIComponent(url.pathname)}`,
			trip: inv.trip
		}
	}

	const existing = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.tripId, inv.tripId), eq(tripMember.userId, locals.user.id))
	})

	if (existing) {
		return {
			state: 'already_member' satisfies InviteState,
			message: '你已經是這個旅程的成員了。',
			trip: inv.trip,
			tripId: inv.tripId
		}
	}

	if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
		return {
			state: 'exhausted' satisfies InviteState,
			message: '這個邀請連結的使用次數已達上限。',
			trip: inv.trip
		}
	}

	if (inv.expiresAt < new Date()) {
		return {
			state: 'expired' satisfies InviteState,
			message: '這個邀請連結已經過期了，請旅程管理員重新產生邀請。',
			trip: inv.trip
		}
	}

	return {
		state: 'ready' satisfies InviteState,
		message: '你受邀加入這個旅程。',
		trip: inv.trip
	}
}

export const actions: Actions = {
	default: async ({ locals, params }) => {
		if (!locals.user) {
			return fail(401, {
				state: 'login_required',
				message: '請先登入後再接受邀請。'
			})
		}

		const inv = await getInvitation(params.token)

		if (!inv) {
			return fail(404, {
				state: 'not_found',
				message: '找不到這個邀請連結。'
			})
		}

		const existing = await db.query.tripMember.findFirst({
			where: and(eq(tripMember.tripId, inv.tripId), eq(tripMember.userId, locals.user.id))
		})

		if (existing) {
			return fail(409, {
				state: 'already_member',
				message: '你已經是這個旅程的成員了。',
				tripId: inv.tripId
			})
		}

		if (inv.maxUses !== null && inv.useCount >= inv.maxUses) {
			return fail(410, {
				state: 'exhausted',
				message: '這個邀請連結的使用次數已達上限。'
			})
		}

		if (inv.expiresAt < new Date()) {
			return fail(410, {
				state: 'expired',
				message: '這個邀請連結已經過期了，請旅程管理員重新產生邀請。'
			})
		}

		await db.transaction(async (tx) => {
			await tx.insert(tripMember).values({
				tripId: inv.tripId,
				userId: locals.user!.id,
				role: 'member'
			})
			await tx
				.update(invitation)
				.set({ useCount: sql`${invitation.useCount} + 1` })
				.where(eq(invitation.id, inv.id))
		})

		return {
			state: 'accepted',
			message: '邀請接受成功，你已加入旅程。',
			tripId: inv.tripId
		}
	}
}
