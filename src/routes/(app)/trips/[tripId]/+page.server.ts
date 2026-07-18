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

export const load: PageServerLoad = ({ locals, params }) => {
	const userId = locals.user!.id
	const criticalItems = db.query.criticalItem.findMany({
		where: eq(criticalItem.tripId, params.tripId),
		with: { confirmations: true }
	})

	return {
		itinerary: db.query.scheduleItem.findMany({
			where: eq(scheduleItem.tripId, params.tripId),
			orderBy: [asc(scheduleItem.date), asc(scheduleItem.order)],
			with: { place: true }
		}),
		memberCount: db.query.tripMember
			.findMany({ where: eq(tripMember.tripId, params.tripId) })
			.then((members) => members.length),
		billCount: db.query.bill
			.findMany({ where: eq(bill.tripId, params.tripId) })
			.then((bills) => bills.length),
		packingCount: db.query.packingList
			.findMany({ where: eq(packingList.tripId, params.tripId), with: { items: true } })
			.then((lists) => lists.reduce((sum, list) => sum + list.items.length, 0)),
		todoCount: db.query.todo
			.findMany({ where: eq(todo.tripId, params.tripId) })
			.then((todos) => todos.filter((item) => !item.isCompleted).length),
		critical: criticalItems.then((items) => ({
			count: items.length,
			unconfirmed: items.filter(
				(item) => !item.confirmations.some((confirmation) => confirmation.userId === userId)
			).length
		})),
		pendingPayments: db.query.settlement
			.findMany({
				where: and(
					eq(settlement.tripId, params.tripId),
					eq(settlement.fromUserId, userId),
					eq(settlement.isSettled, false)
				)
			})
			.then((rows) => ({
				count: rows.length,
				total: Math.round(rows.reduce((sum, s) => sum + s.amount, 0) * 100) / 100
			}))
	}
}
