import { db } from '$lib/server/db'
import {
	bill,
	criticalItem,
	packingList,
	scheduleItem,
	todo,
	tripMember
} from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const [members, itinerary, bills, lists, todos, criticalItems] = await Promise.all([
		db.query.tripMember.findMany({ where: eq(tripMember.tripId, params.tripId) }),
		db.query.scheduleItem.findMany({
			where: eq(scheduleItem.tripId, params.tripId),
			orderBy: [asc(scheduleItem.date), asc(scheduleItem.order)]
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
		})
	])

	return {
		memberCount: members.length,
		itinerary,
		billCount: bills.length,
		packingCount: lists.reduce((sum, list) => sum + list.items.length, 0),
		todoCount: todos.filter((item) => !item.isCompleted).length,
		criticalCount: criticalItems.length
	}
}
