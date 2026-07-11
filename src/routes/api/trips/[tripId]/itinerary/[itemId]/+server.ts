import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { scheduleItem } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const [updated] = await db
		.update(scheduleItem)
		.set({
			...(body.placeId !== undefined && { placeId: body.placeId }),
			...(body.date !== undefined && { date: body.date }),
			...(body.startTime !== undefined && { startTime: body.startTime }),
			...(body.endTime !== undefined && { endTime: body.endTime }),
			...(body.title !== undefined && { title: body.title }),
			...(body.notes !== undefined && { notes: body.notes }),
			...(body.transportMode !== undefined && { transportMode: body.transportMode }),
			...(body.order !== undefined && { order: body.order })
		})
		.where(eq(scheduleItem.id, params.itemId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Schedule item not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.scheduleItem.findFirst({
		where: eq(scheduleItem.id, params.itemId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Schedule item not found')

	await db.delete(scheduleItem).where(eq(scheduleItem.id, params.itemId))
	return new Response(null, { status: 204 })
}
