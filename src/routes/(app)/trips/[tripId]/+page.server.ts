import { db } from '$lib/server/db'
import {
	bill,
	criticalItem,
	packingList,
	scheduleItem,
	settlement,
	todo,
	tripMember
} from '$lib/server/db/schema'
import { and, asc, eq } from 'drizzle-orm'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const userId = locals.user!.id
	const [members, itinerary, bills, lists, todos, criticalItems, pendingSettlements] =
		await Promise.all([
			db.query.tripMember.findMany({ where: eq(tripMember.tripId, params.tripId) }),
			db.query.scheduleItem.findMany({
				where: eq(scheduleItem.tripId, params.tripId),
				orderBy: [asc(scheduleItem.date), asc(scheduleItem.order)],
				with: { place: true }
			}),
			db.query.bill.findMany({ where: eq(bill.tripId, params.tripId) }),
			db.query.packingList.findMany({
				where: eq(packingList.tripId, params.tripId),
				with: { items: true }
			}),
			db.query.todo.findMany({ where: eq(todo.tripId, params.tripId) }),
			db.query.criticalItem.findMany({
				where: eq(criticalItem.tripId, params.tripId),
				with: { confirmations: true }
			}),
			db.query.settlement.findMany({
				where: and(
					eq(settlement.tripId, params.tripId),
					eq(settlement.fromUserId, userId),
					eq(settlement.isSettled, false)
				)
			})
		])

	return {
		memberCount: members.length,
		itinerary,
		billCount: bills.length,
		packingCount: lists.reduce((sum, list) => sum + list.items.length, 0),
		todoCount: todos.filter((item) => !item.isCompleted).length,
		criticalCount: criticalItems.length,
		criticalUnconfirmed: criticalItems.filter(
			(item) => !item.confirmations.some((confirmation) => confirmation.userId === userId)
		).length,
		pendingPaymentCount: pendingSettlements.length,
		pendingPaymentTotal:
			Math.round(pendingSettlements.reduce((sum, s) => sum + s.amount, 0) * 100) / 100
	}
}
