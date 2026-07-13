import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { place } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	const [updated] = await db
		.update(place)
		.set({
			...(body.openingHours !== undefined && { openingHours: body.openingHours || null }),
			...(body.rating !== undefined && {
				rating: body.rating === '' || body.rating == null ? null : Number(body.rating)
			}),
			...(body.ratingCount !== undefined && {
				ratingCount:
					body.ratingCount === '' || body.ratingCount == null ? null : Number(body.ratingCount)
			}),
			...(body.notes !== undefined && { notes: body.notes || null })
		})
		.where(eq(place.id, params.placeId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Place not found')
	return json(updated)
}
