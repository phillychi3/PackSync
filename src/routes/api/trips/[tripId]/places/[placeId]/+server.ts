import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { place } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.place.findFirst({
		where: eq(place.id, params.placeId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Place not found')

	return json(found)
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const [updated] = await db
		.update(place)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.address !== undefined && { address: body.address }),
			...(body.lat !== undefined && { lat: body.lat }),
			...(body.lng !== undefined && { lng: body.lng }),
			...(body.googlePlaceId !== undefined && { googlePlaceId: body.googlePlaceId }),
			...(body.category !== undefined && { category: body.category }),
			...(body.notes !== undefined && { notes: body.notes })
		})
		.where(eq(place.id, params.placeId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Place not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.place.findFirst({
		where: eq(place.id, params.placeId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Place not found')

	await db.delete(place).where(eq(place.id, params.placeId))
	return new Response(null, { status: 204 })
}
