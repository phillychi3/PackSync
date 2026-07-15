import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'
import { eq, and } from 'drizzle-orm'
import { bill, settlement, tripMember } from '$lib/server/db/schema'

export function requireAuth(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Unauthorized')
	return locals.user
}

export async function requireMember(userId: string, tripId: string) {
	const member = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.userId, userId), eq(tripMember.tripId, tripId))
	})
	if (!member) throw error(403, 'Forbidden')
	return member
}

export async function requireAdmin(userId: string, tripId: string) {
	const member = await requireMember(userId, tripId)
	if (member.role === 'member') throw error(403, 'Admin required')
	return member
}

export async function calculateSettlements(tripId: string) {
	const [bills, members] = await Promise.all([
		db.query.bill.findMany({
			where: eq(bill.tripId, tripId),
			with: { payers: true, participants: true, items: true }
		}),
		db.query.tripMember.findMany({ where: eq(tripMember.tripId, tripId) })
	])

	const balances = new Map<string, number>()
	for (const m of members) balances.set(m.userId, 0)
	const transfers: {
		billId: string
		fromUserId: string
		toUserId: string
		amount: number
	}[] = []

	for (const b of bills) {
		const billBalances = new Map<string, number>()
		const totalPaid = b.payers.reduce((s, p) => s + p.amount, 0)
		for (const payer of b.payers) {
			balances.set(payer.userId, (balances.get(payer.userId) ?? 0) + payer.amount)
			billBalances.set(payer.userId, (billBalances.get(payer.userId) ?? 0) + payer.amount)
		}
		if (b.items.length > 0) {
			for (const item of b.items) {
				let participantIds = b.participants.map((p) => p.userId)
				if (item.participants !== null) {
					try {
						participantIds = JSON.parse(item.participants) as string[]
					} catch {
						participantIds = []
					}
				}
				if (participantIds.length === 0) continue
				const owed = item.amount / participantIds.length
				for (const userId of participantIds) {
					balances.set(userId, (balances.get(userId) ?? 0) - owed)
					billBalances.set(userId, (billBalances.get(userId) ?? 0) - owed)
				}
			}
		} else {
			for (const p of b.participants) {
				let owed: number
				if (b.splitMethod === 'equal') owed = totalPaid / b.participants.length
				else if (b.splitMethod === 'percentage') owed = totalPaid * ((p.value ?? 0) / 100)
				else owed = p.value ?? 0 // fixed
				balances.set(p.userId, (balances.get(p.userId) ?? 0) - owed)
				billBalances.set(p.userId, (billBalances.get(p.userId) ?? 0) - owed)
			}
		}

		const creditors: { userId: string; amount: number }[] = []
		const debtors: { userId: string; amount: number }[] = []
		for (const [userId, balance] of billBalances) {
			if (balance > 0.01) creditors.push({ userId, amount: balance })
			else if (balance < -0.01) debtors.push({ userId, amount: -balance })
		}
		creditors.sort((a, b) => a.amount - b.amount)
		debtors.sort((a, b) => a.amount - b.amount)
		let i = 0
		let j = 0
		while (i < creditors.length && j < debtors.length) {
			const amount = Math.min(creditors[i].amount, debtors[j].amount)
			transfers.push({
				billId: b.id,
				fromUserId: debtors[j].userId,
				toUserId: creditors[i].userId,
				amount: Math.round(amount * 100) / 100
			})
			creditors[i].amount -= amount
			debtors[j].amount -= amount
			if (creditors[i].amount < 0.01) i++
			if (debtors[j].amount < 0.01) j++
		}
	}

	return {
		balances: Object.fromEntries(
			[...balances.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])
		),
		transfers
	}
}

/** Legacy helper retained for callers that explicitly want to rebuild all rows. */
export async function invalidateSettlements(tripId: string) {
	await db.delete(settlement).where(eq(settlement.tripId, tripId))
}

export type SettlementDetail = {
	billId: string
	billTitle: string
	itemName: string
	amount: number
}

export async function addSettlementDetails<
	T extends { billId?: string | null; fromUserId: string; amount: number }
>(tripId: string, settlements: T[]) {
	const bills = await db.query.bill.findMany({
		where: eq(bill.tripId, tripId),
		with: { payers: true, participants: true, items: true }
	})
	const obligations = new Map<string, SettlementDetail[]>()

	const addObligation = (userId: string, detail: SettlementDetail) => {
		const key = `${detail.billId}:${userId}`
		const list = obligations.get(key) ?? []
		list.push(detail)
		obligations.set(key, list)
	}

	for (const b of bills) {
		const totalPaid = b.payers.reduce((sum, payer) => sum + payer.amount, 0)
		if (b.items.length > 0) {
			for (const item of b.items) {
				let participantIds = b.participants.map((participant) => participant.userId)
				if (item.participants !== null) {
					try {
						participantIds = JSON.parse(item.participants) as string[]
					} catch {
						participantIds = []
					}
				}
				if (participantIds.length === 0) continue
				for (const userId of participantIds) {
					addObligation(userId, {
						billId: b.id,
						billTitle: b.title,
						itemName: item.name,
						amount: item.amount / participantIds.length
					})
				}
			}
			continue
		}

		for (const participant of b.participants) {
			let amount: number
			if (b.splitMethod === 'equal') amount = totalPaid / b.participants.length
			else if (b.splitMethod === 'percentage') amount = totalPaid * ((participant.value ?? 0) / 100)
			else amount = participant.value ?? 0
			addObligation(participant.userId, {
				billId: b.id,
				billTitle: b.title,
				itemName: '帳單',
				amount
			})
		}
	}

	return settlements.map((settlementRow) => {
		let remaining = settlementRow.amount
		const details: SettlementDetail[] = []
		const key = settlementRow.billId
			? `${settlementRow.billId}:${settlementRow.fromUserId}`
			: settlementRow.fromUserId
		const userObligations = obligations.get(key) ?? []
		for (const obligation of userObligations) {
			if (remaining <= 0.005) break
			const amount = Math.min(remaining, obligation.amount)
			if (amount > 0.005) details.push({ ...obligation, amount: Math.round(amount * 100) / 100 })
			remaining -= amount
			obligation.amount -= amount
		}
		return { ...settlementRow, details }
	})
}
