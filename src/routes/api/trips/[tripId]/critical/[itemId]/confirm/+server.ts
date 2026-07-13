import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { criticalItem, criticalItemConfirmation, scheduleItem } from '$lib/server/db/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const item = await db.query.criticalItem.findFirst({
		where: eq(criticalItem.id, params.itemId)
	})
	if (!item || item.tripId !== params.tripId) throw error(404, 'Critical item not found')
	const body = await request.json().catch(() => ({}))
	if (!body.scheduleItemId) throw error(400, '需要指定行程')
	const selectedSchedule = await db.query.scheduleItem.findFirst({
		where: and(eq(scheduleItem.id, body.scheduleItemId), eq(scheduleItem.tripId, params.tripId))
	})
	if (!selectedSchedule) throw error(400, '選擇的行程不屬於目前旅程')

	const existing = await db.query.criticalItemConfirmation.findFirst({
		where: and(
			eq(criticalItemConfirmation.criticalItemId, params.itemId),
			eq(criticalItemConfirmation.userId, user.id),
			eq(criticalItemConfirmation.scheduleItemId, body.scheduleItemId)
		)
	})
	if (existing) return json(existing)

	const [created] = await db
		.insert(criticalItemConfirmation)
		.values({
			criticalItemId: params.itemId,
			userId: user.id,
			scheduleItemId: body.scheduleItemId
		})
		.returning()

	return json(created, { status: 201 })
}

export const DELETE: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))
	const conf = await db.query.criticalItemConfirmation.findFirst({
		where: and(
			eq(criticalItemConfirmation.criticalItemId, params.itemId),
			eq(criticalItemConfirmation.userId, user.id),
			body.scheduleItemId
				? eq(criticalItemConfirmation.scheduleItemId, body.scheduleItemId)
				: isNull(criticalItemConfirmation.scheduleItemId)
		)
	})
	if (!conf) throw error(404, 'Confirmation not found')

	await db.delete(criticalItemConfirmation).where(eq(criticalItemConfirmation.id, conf.id))
	return new Response(null, { status: 204 })
}
