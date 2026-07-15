import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { tripMember } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth, requireAdmin, requireMember } from '$lib/server/api'

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	const authUser = requireAuth(locals)
	const admin = await requireAdmin(authUser.id, params.tripId)

	const body = await request.json()
	if (!['owner', 'admin', 'member'].includes(body.role)) throw error(400, 'Invalid role')

	const target = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, params.userId))
	})
	if (!target) throw error(404, 'Member not found')
	if (target.role === 'owner') throw error(403, 'Cannot change owner role')

	if (body.role === 'owner') {
		if (admin.role !== 'owner') throw error(403, 'Only owner can transfer ownership')
		const [updated] = await db.transaction(async (tx) => {
			await tx
				.update(tripMember)
				.set({ role: 'admin' })
				.where(and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, authUser.id)))
			return tx
				.update(tripMember)
				.set({ role: 'owner' })
				.where(and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, params.userId)))
				.returning()
		})
		return json(updated)
	}

	if (body.role === 'admin' && admin.role !== 'owner') throw error(403, 'Only owner can set admin')

	const [updated] = await db
		.update(tripMember)
		.set({ role: body.role })
		.where(and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, params.userId)))
		.returning()

	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const authUser = requireAuth(locals)

	if (authUser.id !== params.userId) {
		await requireAdmin(authUser.id, params.tripId)
	} else {
		await requireMember(authUser.id, params.tripId)
	}

	const target = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, params.userId))
	})
	if (!target) throw error(404, 'Member not found')
	if (target.role === 'owner') throw error(403, 'Cannot remove trip owner')

	await db
		.delete(tripMember)
		.where(and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, params.userId)))

	return new Response(null, { status: 204 })
}
