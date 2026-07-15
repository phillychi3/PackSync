import { db } from '$lib/server/db'
import { criticalItem, scheduleItem, settlement, todo } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'

export type NotificationItem = {
	key: string
	type: 'itinerary' | 'critical' | 'bills' | 'todos'
	title: string
	body: string
	date?: string
	url: string
}

/** Builds the current in-app notifications for a user, mirroring what push reminders cover. */
export async function buildNotifications(
	tripId: string,
	userId: string
): Promise<NotificationItem[]> {
	const [schedules, criticals, todos, pendingSettlements] = await Promise.all([
		db.query.scheduleItem.findMany({ where: eq(scheduleItem.tripId, tripId) }),
		db.query.criticalItem.findMany({
			where: eq(criticalItem.tripId, tripId),
			with: { confirmations: true }
		}),
		db.query.todo.findMany({ where: and(eq(todo.tripId, tripId), eq(todo.isCompleted, false)) }),
		db.query.settlement.findMany({
			where: and(eq(settlement.tripId, tripId), eq(settlement.isSettled, false))
		})
	])

	const today = new Date().toISOString().slice(0, 10)
	const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
	const upcoming = schedules.filter((item) => item.date >= today && item.date <= nextWeek)

	const items: NotificationItem[] = []

	for (const item of upcoming) {
		items.push({
			key: `schedule:${item.id}`,
			type: 'itinerary',
			title: item.title,
			body: `${item.date}${item.startTime ? ` ${item.startTime}` : ''} 的行程即將到來。`,
			date: item.date,
			url: `/trips/${tripId}/itinerary`
		})
	}

	for (const critical of criticals) {
		const related = critical.scheduleItemId
			? upcoming.filter((schedule) => schedule.id === critical.scheduleItemId)
			: upcoming
		for (const schedule of related) {
			const confirmed = critical.confirmations.some(
				(confirmation) =>
					confirmation.userId === userId && confirmation.scheduleItemId === schedule.id
			)
			if (confirmed) continue
			items.push({
				key: `critical:${critical.id}:${schedule.id}`,
				type: 'critical',
				title: `出發前確認：${critical.name}`,
				body: `${schedule.date}${schedule.startTime ? ` ${schedule.startTime}` : ''} 開始前請確認。`,
				date: schedule.date,
				url: `/trips/${tripId}/critical`
			})
		}
	}

	for (const item of pendingSettlements) {
		if (item.fromUserId !== userId) continue
		items.push({
			key: `settlement:${item.id}`,
			type: 'bills',
			title: '有待處理的轉帳',
			body: `尚有 ${item.amount.toFixed(2)} 的款項未付清。`,
			url: `/trips/${tripId}/expenses`
		})
	}

	for (const item of todos) {
		if (!item.dueDate || item.dueDate > nextWeek) continue
		items.push({
			key: `todo:${item.id}`,
			type: 'todos',
			title: item.title,
			body: item.dueDate < today ? '已逾期，請盡快處理。' : `截止日：${item.dueDate}`,
			date: item.dueDate,
			url: `/trips/${tripId}/todos`
		})
	}

	return items
}
