import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { invitation, tripMember } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	requireAuth(locals)

	const inv = await db.query.invitation.findFirst({
		where: eq(invitation.token, params.token),
		with: { trip: true }
	})

	if (!inv) throw error(404, 'Invitation not found')
	if (inv.usedAt) throw error(410, 'Invitation already used')
	if (inv.expiresAt < new Date()) throw error(410, 'Invitation expired')

	return json({ invitation: inv, trip: inv.trip })
}

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)

	const inv = await db.query.invitation.findFirst({
		where: eq(invitation.token, params.token)
	})

	if (!inv) throw error(404, 'Invitation not found')
	if (inv.usedAt) throw error(410, 'Invitation already used')
	if (inv.expiresAt < new Date()) throw error(410, 'Invitation expired')

	const existing = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.tripId, inv.tripId), eq(tripMember.userId, user.id))
	})

	if (existing) {
		return json({ tripId: inv.tripId, alreadyMember: true })
	}

	await db.transaction(async (tx) => {
		await tx.insert(tripMember).values({
			tripId: inv.tripId,
			userId: user.id,
			role: 'member'
		})
		await tx
			.update(invitation)
			.set({ usedAt: new Date(), usedBy: user.id })
			.where(eq(invitation.id, inv.id))
	})

	return json({ tripId: inv.tripId }, { status: 201 })
}
