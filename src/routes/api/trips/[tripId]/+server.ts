import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { trip } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember, requireAdmin } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.trip.findFirst({
		where: eq(trip.id, params.tripId)
	})
	if (!found) throw error(404, 'Trip not found')

	return json(found)
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireAdmin(user.id, params.tripId)

	const body = await request.json()

	const [updated] = await db
		.update(trip)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.description !== undefined && { description: body.description }),
			...(body.destination !== undefined && { destination: body.destination }),
			...(body.startDate !== undefined && { startDate: body.startDate }),
			...(body.endDate !== undefined && { endDate: body.endDate }),
			...(body.status !== undefined && { status: body.status }),
			...(body.currency !== undefined && { currency: body.currency }),
			...(body.coverImage !== undefined && { coverImage: body.coverImage })
		})
		.where(eq(trip.id, params.tripId))
		.returning()

	if (!updated) throw error(404, 'Trip not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	const member = await requireMember(user.id, params.tripId)
	if (member.role !== 'owner') throw error(403, 'Only the owner can delete the trip')

	await db.delete(trip).where(eq(trip.id, params.tripId))
	return new Response(null, { status: 204 })
}
