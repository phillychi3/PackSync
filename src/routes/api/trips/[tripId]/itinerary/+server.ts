import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { scheduleItem } from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const date = url.searchParams.get('date')

	const items = await db.query.scheduleItem.findMany({
		where: eq(scheduleItem.tripId, params.tripId),
		orderBy: [asc(scheduleItem.date), asc(scheduleItem.order)]
	})

	return json(date ? items.filter((i) => i.date === date) : items)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (!body.date) throw error(400, 'Date is required')
	if (!body.title?.trim()) throw error(400, 'Title is required')

	const [created] = await db
		.insert(scheduleItem)
		.values({
			tripId: params.tripId,
			placeId: body.placeId ?? null,
			date: body.date,
			startTime: body.startTime ?? null,
			endTime: body.endTime ?? null,
			title: body.title,
			notes: body.notes ?? null,
			transportMode: body.transportMode ?? null,
			order: body.order ?? 0
		})
		.returning()

	return json(created, { status: 201 })
}
