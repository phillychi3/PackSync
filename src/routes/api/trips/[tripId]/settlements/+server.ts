import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { settlement } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import {
	addSettlementDetails,
	calculateSettlements,
	requireAuth,
	requireMember
} from '$lib/server/api'

const userColumns = { id: true, name: true, email: true, image: true } as const

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const settlements = await db.query.settlement.findMany({
		where: eq(settlement.tripId, params.tripId),
		with: {
			fromUser: { columns: userColumns },
			toUser: { columns: userColumns }
		}
	})

	return json(await addSettlementDetails(params.tripId, settlements))
}

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const { transfers } = await calculateSettlements(params.tripId)

	const existingSettlements = await db.query.settlement.findMany({
		where: eq(settlement.tripId, params.tripId)
	})
	for (const existing of existingSettlements) {
		if (!existing.isSettled) await db.delete(settlement).where(eq(settlement.id, existing.id))
	}

	if (transfers.length > 0) {
		const settledKeys = new Set(
			existingSettlements
				.filter((item) => item.isSettled)
				.map(
					(item) => `${item.billId}:${item.fromUserId}:${item.toUserId}:${item.amount.toFixed(2)}`
				)
		)
		const newTransfers = transfers.filter(
			(t) => !settledKeys.has(`${t.billId}:${t.fromUserId}:${t.toUserId}:${t.amount.toFixed(2)}`)
		)
		if (newTransfers.length > 0) {
			await db.insert(settlement).values(
				newTransfers.map((t) => ({
					tripId: params.tripId,
					billId: t.billId,
					fromUserId: t.fromUserId,
					toUserId: t.toUserId,
					amount: t.amount
				}))
			)
		}
	}

	const newSettlements = await db.query.settlement.findMany({
		where: eq(settlement.tripId, params.tripId),
		with: {
			fromUser: { columns: userColumns },
			toUser: { columns: userColumns }
		}
	})

	return json(await addSettlementDetails(params.tripId, newSettlements))
}
