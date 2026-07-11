import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { tripMember, user } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const authUser = requireAuth(locals)
	await requireMember(authUser.id, params.tripId)

	const members = await db
		.select({
			id: tripMember.id,
			tripId: tripMember.tripId,
			userId: tripMember.userId,
			role: tripMember.role,
			joinedAt: tripMember.joinedAt,
			name: user.name,
			email: user.email,
			image: user.image
		})
		.from(tripMember)
		.innerJoin(user, eq(tripMember.userId, user.id))
		.where(eq(tripMember.tripId, params.tripId))

	return json(members)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const authUser = requireAuth(locals)
	await requireMember(authUser.id, params.tripId)

	const body = await request.json()

	return json(body, { status: 201 })
}
