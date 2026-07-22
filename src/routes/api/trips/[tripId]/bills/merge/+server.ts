import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { bill } from '$lib/server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { rebuildSettlements, requireAuth, requireMember } from '$lib/server/api'

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = (await request.json().catch(() => null)) as { billIds?: string[] } | null
	const billIds = [...new Set(body?.billIds ?? [])]
	if (billIds.length < 2) throw error(400, 'At least two bills are required to merge')

	const bills = await db.query.bill.findMany({
		where: and(eq(bill.tripId, params.tripId), inArray(bill.id, billIds)),
		columns: { id: true }
	})
	if (bills.length !== billIds.length) throw error(400, 'Some bills do not belong to this trip')

	const groupId = crypto.randomUUID()
	await db
		.update(bill)
		.set({ mergeGroupId: groupId })
		.where(and(eq(bill.tripId, params.tripId), inArray(bill.id, billIds)))

	return json(await rebuildSettlements(params.tripId))
}

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = (await request.json().catch(() => null)) as { groupId?: string } | null
	if (!body?.groupId) throw error(400, 'groupId is required')

	await db
		.update(bill)
		.set({ mergeGroupId: null })
		.where(and(eq(bill.tripId, params.tripId), eq(bill.mergeGroupId, body.groupId)))

	return json(await rebuildSettlements(params.tripId))
}
