import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { criticalItem, scheduleItem } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (body.scheduleItemId) {
		const selectedSchedule = await db.query.scheduleItem.findFirst({
			where: and(eq(scheduleItem.id, body.scheduleItemId), eq(scheduleItem.tripId, params.tripId))
		})
		if (!selectedSchedule) throw error(400, '選擇的情境不屬於目前旅程')
	}

	const [updated] = await db
		.update(criticalItem)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.description !== undefined && { description: body.description }),
			...(body.icon !== undefined && { icon: body.icon }),
			...(body.scheduleItemId !== undefined && { scheduleItemId: body.scheduleItemId || null })
		})
		.where(eq(criticalItem.id, params.itemId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Critical item not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.criticalItem.findFirst({
		where: eq(criticalItem.id, params.itemId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Critical item not found')

	await db.delete(criticalItem).where(eq(criticalItem.id, params.itemId))
	return new Response(null, { status: 204 })
}
