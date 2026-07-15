import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { settlement } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'
import { pushToTripMembers } from '$lib/server/notify'

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const found = await db.query.settlement.findFirst({
		where: eq(settlement.id, params.settlementId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Settlement not found')

	const isSettled = body.isSettled !== false

	const [updated] = await db
		.update(settlement)
		.set({
			isSettled,
			settledAt: isSettled ? new Date() : null
		})
		.where(eq(settlement.id, params.settlementId))
		.returning()

	if (isSettled && !found.isSettled) {
		await pushToTripMembers(
			params.tripId,
			{
				title: '結算完成',
				body: `一筆 ${updated.amount.toFixed(2)} 的款項已標記付清`,
				url: `/trips/${params.tripId}/expenses`
			},
			{
				onlyUserIds: [updated.fromUserId, updated.toUserId],
				excludeUserId: user.id,
				respectBillPref: true
			}
		)
	}

	return json(updated)
}
