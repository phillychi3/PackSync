import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'
import { eq, and } from 'drizzle-orm'
import { bill, settlement, tripMember } from '$lib/server/db/schema'

export type Transfer = {
	billId: string | null
	mergeGroupId: string | null
	fromUserId: string
	toUserId: string
	amount: number
}

/** One original per-bill debt inside a merged group, before it is netted away. */
export type ChainLink = {
	billId: string
	billTitle: string
	fromUserId: string
	toUserId: string
	amount: number
}

type BillForCalc = {
	id: string
	title: string
	mergeGroupId: string | null
	splitMethod: 'equal' | 'percentage' | 'fixed'
	payers: { userId: string; amount: number }[]
	participants: { userId: string; value: number | null }[]
	items: { name: string; amount: number; participants: string | null }[]
}

/** Bills sharing a non-null mergeGroupId settle together; standalone bills key on their own id. */
const groupKeyOf = (b: { id: string; mergeGroupId: string | null }) => b.mergeGroupId ?? b.id

const userColumns = { id: true, name: true, email: true, image: true } as const

/** Add a bill's payer credits and participant debts into every provided balance map. */
function applyBillBalances(b: BillForCalc, maps: Map<string, number>[]) {
	const add = (userId: string, delta: number) => {
		for (const map of maps) map.set(userId, (map.get(userId) ?? 0) + delta)
	}
	const totalPaid = b.payers.reduce((sum, p) => sum + p.amount, 0)
	for (const payer of b.payers) add(payer.userId, payer.amount)

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
			for (const userId of participantIds) add(userId, -owed)
		}
		return
	}

	for (const p of b.participants) {
		let owed: number
		if (b.splitMethod === 'equal') owed = totalPaid / b.participants.length
		else if (b.splitMethod === 'percentage') owed = totalPaid * ((p.value ?? 0) / 100)
		else owed = p.value ?? 0 // fixed
		add(p.userId, -owed)
	}
}

/** Greedy min-cash-flow: net a group's balances into the fewest possible transfers. */
function minCashFlow(
	balances: Map<string, number>,
	tag: { billId: string | null; mergeGroupId: string | null }
): Transfer[] {
	const creditors: { userId: string; amount: number }[] = []
	const debtors: { userId: string; amount: number }[] = []
	for (const [userId, balance] of balances) {
		if (balance > 0.01) creditors.push({ userId, amount: balance })
		else if (balance < -0.01) debtors.push({ userId, amount: -balance })
	}
	creditors.sort((a, b) => b.amount - a.amount)
	debtors.sort((a, b) => b.amount - a.amount)

	const transfers: Transfer[] = []
	let i = 0
	let j = 0
	while (i < creditors.length && j < debtors.length) {
		const amount = Math.min(creditors[i].amount, debtors[j].amount)
		transfers.push({
			...tag,
			fromUserId: debtors[j].userId,
			toUserId: creditors[i].userId,
			amount: Math.round(amount * 100) / 100
		})
		creditors[i].amount -= amount
		debtors[j].amount -= amount
		if (creditors[i].amount < 0.01) i++
		if (debtors[j].amount < 0.01) j++
	}
	return transfers
}

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

	const groups = new Map<string, BillForCalc[]>()
	for (const b of bills) {
		const key = groupKeyOf(b)
		const list = groups.get(key) ?? []
		list.push(b)
		groups.set(key, list)
	}

	const transfers: Transfer[] = []
	// For merged groups: the per-bill debts that get netted into the merged transfer,
	// keyed by mergeGroupId so the UI can show the simplification chain.
	const chains: Record<string, ChainLink[]> = {}
	for (const [key, groupBills] of groups) {
		const isMerged = groupBills[0].mergeGroupId !== null
		const groupBalances = new Map<string, number>()
		for (const b of groupBills) applyBillBalances(b, [balances, groupBalances])
		const tag = isMerged ? { billId: null, mergeGroupId: key } : { billId: key, mergeGroupId: null }
		transfers.push(...minCashFlow(groupBalances, tag))

		if (isMerged) {
			const links: ChainLink[] = []
			for (const b of groupBills) {
				const billBalances = new Map<string, number>()
				applyBillBalances(b, [billBalances])
				for (const raw of minCashFlow(billBalances, { billId: b.id, mergeGroupId: key })) {
					links.push({
						billId: b.id,
						billTitle: b.title,
						fromUserId: raw.fromUserId,
						toUserId: raw.toUserId,
						amount: raw.amount
					})
				}
			}
			chains[key] = links
		}
	}

	return {
		balances: Object.fromEntries(
			[...balances.entries()].map(([k, v]) => [k, Math.round(v * 100) / 100])
		),
		transfers,
		chains
	}
}

const settledKey = (t: {
	billId: string | null
	mergeGroupId: string | null
	fromUserId: string
	toUserId: string
	amount: number
}) =>
	`${t.billId ?? ''}:${t.mergeGroupId ?? ''}:${t.fromUserId}:${t.toUserId}:${t.amount.toFixed(2)}`

/**
 * Recompute settlement rows for a trip, keeping any already-settled transfers whose
 * group still exists and dropping the rest so nothing is double-counted.
 */
export async function rebuildSettlements(tripId: string) {
	const [{ transfers }, bills, existing] = await Promise.all([
		calculateSettlements(tripId),
		db.query.bill.findMany({
			where: eq(bill.tripId, tripId),
			columns: { id: true, mergeGroupId: true }
		}),
		db.query.settlement.findMany({ where: eq(settlement.tripId, tripId) })
	])

	const validGroupKeys = new Set(bills.map(groupKeyOf))
	const keptSettled: typeof existing = []
	for (const row of existing) {
		const groupKey = row.mergeGroupId ?? row.billId
		if (row.isSettled && groupKey && validGroupKeys.has(groupKey)) keptSettled.push(row)
		else await db.delete(settlement).where(eq(settlement.id, row.id))
	}

	const settledKeys = new Set(keptSettled.map(settledKey))
	const newTransfers = transfers.filter((t) => !settledKeys.has(settledKey(t)))
	if (newTransfers.length > 0) {
		await db.insert(settlement).values(
			newTransfers.map((t) => ({
				tripId,
				billId: t.billId,
				mergeGroupId: t.mergeGroupId,
				fromUserId: t.fromUserId,
				toUserId: t.toUserId,
				amount: t.amount
			}))
		)
	}

	const rows = await db.query.settlement.findMany({
		where: eq(settlement.tripId, tripId),
		with: { fromUser: { columns: userColumns }, toUser: { columns: userColumns } }
	})
	return addSettlementDetails(tripId, rows)
}

export type SettlementDetail = {
	billId: string
	billTitle: string
	itemName: string
	amount: number
}

export async function addSettlementDetails<
	T extends {
		billId?: string | null
		mergeGroupId?: string | null
		fromUserId: string
		amount: number
	}
>(tripId: string, settlements: T[]) {
	const bills = await db.query.bill.findMany({
		where: eq(bill.tripId, tripId),
		with: { payers: true, participants: true, items: true }
	})
	const obligations = new Map<string, SettlementDetail[]>()

	const addObligation = (groupKey: string, userId: string, detail: SettlementDetail) => {
		const key = `${groupKey}:${userId}`
		const list = obligations.get(key) ?? []
		list.push(detail)
		obligations.set(key, list)
	}

	for (const b of bills) {
		const groupKey = groupKeyOf(b)
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
					addObligation(groupKey, userId, {
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
			addObligation(groupKey, participant.userId, {
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
		const groupKey = settlementRow.mergeGroupId ?? settlementRow.billId
		const userObligations = groupKey
			? (obligations.get(`${groupKey}:${settlementRow.fromUserId}`) ?? [])
			: []
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
