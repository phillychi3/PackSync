import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { trip, tripMember } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals)

	const memberships = await db.query.tripMember.findMany({
		where: eq(tripMember.userId, user.id),
		with: { trip: true }
	})

	return json(memberships.map((m) => ({ ...m.trip, role: m.role })))
}

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireAuth(locals)
	const body = await request.json()

	if (!body.name?.trim()) throw error(400, 'Name is required')

	const newTrip = await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(trip)
			.values({
				name: body.name,
				description: body.description ?? null,
				destination: body.destination ?? null,
				startDate: body.startDate ?? null,
				endDate: body.endDate ?? null,
				currency: body.currency ?? 'TWD',
				createdBy: user.id
			})
			.returning()

		await tx.insert(tripMember).values({
			tripId: created.id,
			userId: user.id,
			role: 'owner'
		})

		return created
	})

	return json(newTrip, { status: 201 })
}
