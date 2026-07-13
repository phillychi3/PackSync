import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { place } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const places = await db.query.place.findMany({
		where: eq(place.tripId, params.tripId)
	})

	return json(places)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (!body.name?.trim()) throw error(400, 'Name is required')

	const [created] = await db
		.insert(place)
		.values({
			tripId: params.tripId,
			name: body.name,
			address: body.address ?? null,
			lat: body.lat ?? null,
			lng: body.lng ?? null,
			googlePlaceId: body.googlePlaceId ?? null,
			category: body.category ?? null,
			openingHours: body.openingHours ?? null,
			rating: body.rating === '' || body.rating == null ? null : Number(body.rating),
			ratingCount:
				body.ratingCount === '' || body.ratingCount == null ? null : Number(body.ratingCount),
			notes: body.notes ?? null
		})
		.returning()

	return json(created, { status: 201 })
}
