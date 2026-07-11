import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { bill, tripMember } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const [bills, members] = await Promise.all([
		db.query.bill.findMany({
			where: eq(bill.tripId, params.tripId),
			with: { payers: true, participants: true }
		}),
		db.query.tripMember.findMany({
			where: eq(tripMember.tripId, params.tripId)
		})
	])

	const balances = new Map<string, number>()
	for (const m of members) balances.set(m.userId, 0)

	for (const b of bills) {
		const totalPaid = b.payers.reduce((sum, p) => sum + p.amount, 0)

		for (const payer of b.payers) {
			balances.set(payer.userId, (balances.get(payer.userId) ?? 0) + payer.amount)
		}

		for (const participant of b.participants) {
			let owed = 0
			if (b.splitMethod === 'equal') {
				owed = totalPaid / b.participants.length
			} else if (b.splitMethod === 'shares') {
				const totalShares = b.participants.reduce((sum, p) => sum + (p.value ?? 1), 0)
				owed = totalPaid * ((participant.value ?? 1) / totalShares)
			} else if (b.splitMethod === 'percentage') {
				owed = totalPaid * ((participant.value ?? 0) / 100)
			} else {
				owed = participant.value ?? 0
			}
			balances.set(participant.userId, (balances.get(participant.userId) ?? 0) - owed)
		}
	}

	const creditors: { userId: string; amount: number }[] = []
	const debtors: { userId: string; amount: number }[] = []

	for (const [userId, balance] of balances) {
		if (balance > 0.01) creditors.push({ userId, amount: balance })
		else if (balance < -0.01) debtors.push({ userId, amount: -balance })
	}

	creditors.sort((a, b) => a.amount - b.amount)
	debtors.sort((a, b) => a.amount - b.amount)

	const transfers: { fromUserId: string; toUserId: string; amount: number }[] = []
	let i = 0
	let j = 0

	while (i < creditors.length && j < debtors.length) {
		const amount = Math.min(creditors[i].amount, debtors[j].amount)
		transfers.push({
			fromUserId: debtors[j].userId,
			toUserId: creditors[i].userId,
			amount: Math.round(amount * 100) / 100
		})
		creditors[i].amount -= amount
		debtors[j].amount -= amount
		if (creditors[i].amount < 0.01) i++
		if (debtors[j].amount < 0.01) j++
	}

	return json({
		balances: Object.fromEntries(
			[...balances.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])
		),
		transfers
	})
}
