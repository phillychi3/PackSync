import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db'
import {
	criticalItem,
	notificationLog,
	notificationPreference,
	pushSubscription,
	scheduleItem,
	settlement,
	todo,
	tripMember
} from '$lib/server/db/schema'
import { sendWebPush, webPushConfigured } from '$lib/server/push'
import { and, eq, inArray } from 'drizzle-orm'

type Reminder = { key: string; title: string; body: string; url: string }

function itemStart(date: string, startTime: string | null) {
	return new Date(`${date}T${startTime ?? '09:00'}:00`)
}

export const POST: RequestHandler = async ({ request }) => {
	if (!env.CRON_SECRET) throw error(503, 'CRON_SECRET is not configured')
	const provided =
		request.headers.get('x-cron-secret') ??
		request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
	if (provided !== env.CRON_SECRET) throw error(401, 'Unauthorized')
	if (!webPushConfigured) throw error(503, 'Web Push is not configured')

	const subscriptions = await db.query.pushSubscription.findMany()
	const byUser = new Map<string, typeof subscriptions>()
	for (const sub of subscriptions) {
		const list = byUser.get(sub.userId) ?? []
		list.push(sub)
		byUser.set(sub.userId, list)
	}

	const now = new Date()
	let sent = 0

	for (const [userId, subs] of byUser) {
		const prefs = (await db.query.notificationPreference.findFirst({
			where: eq(notificationPreference.userId, userId)
		})) ?? {
			remindItinerary: true,
			remindCritical: true,
			remindBills: true,
			remindTodos: true,
			leadHours: 24
		}
		const windowEnd = new Date(now.getTime() + prefs.leadHours * 3600000)
		const todayStr = now.toISOString().slice(0, 10)
		const windowEndDate = windowEnd.toISOString().slice(0, 10)

		const memberships = await db.query.tripMember.findMany({
			where: eq(tripMember.userId, userId)
		})
		const tripIds = memberships.map((m) => m.tripId)
		if (tripIds.length === 0) continue

		const reminders: Reminder[] = []

		const upcoming = await db.query.scheduleItem.findMany({
			where: inArray(scheduleItem.tripId, tripIds)
		})
		const inWindow = upcoming.filter((item) => {
			const start = itemStart(item.date, item.startTime)
			return start >= now && start <= windowEnd
		})

		if (prefs.remindItinerary) {
			for (const item of inWindow) {
				reminders.push({
					key: `schedule:${item.id}`,
					title: `行程提醒：${item.title}`,
					body: `${item.date}${item.startTime ? ` ${item.startTime}` : ''} 即將開始。`,
					url: `/trips/${item.tripId}/itinerary`
				})
			}
		}

		if (prefs.remindCritical && inWindow.length > 0) {
			const criticals = await db.query.criticalItem.findMany({
				where: inArray(criticalItem.tripId, tripIds),
				with: { confirmations: true }
			})
			for (const item of criticals) {
				const related = item.scheduleItemId
					? inWindow.filter((schedule) => schedule.id === item.scheduleItemId)
					: inWindow.filter((schedule) => schedule.tripId === item.tripId)
				for (const schedule of related) {
					const confirmed = item.confirmations.some(
						(confirmation) =>
							confirmation.userId === userId && confirmation.scheduleItemId === schedule.id
					)
					if (confirmed) continue
					reminders.push({
						key: `critical:${item.id}:${schedule.id}`,
						title: `出發前確認：${item.name}`,
						body: `${schedule.date}${schedule.startTime ? ` ${schedule.startTime}` : ''} 的「${schedule.title}」出發前請確認。`,
						url: `/trips/${item.tripId}/critical`
					})
				}
			}
		}

		if (prefs.remindTodos) {
			const todos = await db.query.todo.findMany({
				where: and(inArray(todo.tripId, tripIds), eq(todo.isCompleted, false))
			})
			for (const item of todos) {
				if (!item.dueDate || item.dueDate < todayStr || item.dueDate > windowEndDate) continue
				if (item.assignedTo !== null && item.assignedTo !== userId) continue
				reminders.push({
					key: `todo:${item.id}:${item.dueDate}`,
					title: `待辦即將到期：${item.title}`,
					body: `截止日：${item.dueDate}`,
					url: `/trips/${item.tripId}/todos`
				})
			}
		}

		if (prefs.remindBills) {
			const pending = await db.query.settlement.findMany({
				where: and(
					inArray(settlement.tripId, tripIds),
					eq(settlement.fromUserId, userId),
					eq(settlement.isSettled, false)
				)
			})
			for (const item of pending) {
				reminders.push({
					key: `settlement:${item.id}`,
					title: '有待付款的分帳',
					body: `你還有 ${item.amount.toFixed(2)} 的款項未結清。`,
					url: `/trips/${item.tripId}/expenses`
				})
			}
		}

		if (reminders.length === 0) continue

		const keys = reminders.map((r) => r.key)
		const sentLogs = await db.query.notificationLog.findMany({
			where: and(eq(notificationLog.userId, userId), inArray(notificationLog.key, keys))
		})
		const alreadySent = new Set(sentLogs.map((log) => log.key))
		const fresh = reminders.filter((r) => !alreadySent.has(r.key))

		for (const reminder of fresh) {
			let delivered = false
			for (const sub of subs) {
				try {
					await sendWebPush(sub, {
						title: reminder.title,
						body: reminder.body,
						url: reminder.url
					})
					delivered = true
				} catch (err) {
					const statusCode = (err as { statusCode?: number }).statusCode
					if (statusCode === 404 || statusCode === 410) {
						await db.delete(pushSubscription).where(eq(pushSubscription.id, sub.id))
					}
				}
			}
			if (delivered) {
				await db.insert(notificationLog).values({ userId, key: reminder.key }).onConflictDoNothing()
				sent++
			}
		}
	}

	return json({ sent })
}
