import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { invitation } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireAdmin(user.id, params.tripId)

	const invites = await db.query.invitation.findMany({
		where: eq(invitation.tripId, params.tripId)
	})

	return json(invites)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireAdmin(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))
	const expiresInHours = body.expiresInHours ?? 24
	const expiresAt = new Date(Date.now() + expiresInHours * 3600 * 1000)
	const token = crypto.randomUUID()

	const [created] = await db
		.insert(invitation)
		.values({
			tripId: params.tripId,
			token,
			createdBy: user.id,
			expiresAt
		})
		.returning()

	return json(created, { status: 201 })
}
