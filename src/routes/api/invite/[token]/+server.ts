import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { invitation, tripMember } from '$lib/server/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'
import { pushToTripMembers } from '$lib/server/notify'

export const GET: RequestHandler = async ({ locals, params }) => {
	requireAuth(locals)

	const inv = await db.query.invitation.findFirst({
		where: eq(invitation.token, params.token),
		with: { trip: true }
	})

	if (!inv) throw error(404, 'Invitation not found')
	if (inv.maxUses !== null && inv.useCount >= inv.maxUses)
		throw error(410, 'Invitation use limit reached')
	if (inv.expiresAt < new Date()) throw error(410, 'Invitation expired')

	return json({ invitation: inv, trip: inv.trip })
}

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)

	const inv = await db.query.invitation.findFirst({
		where: eq(invitation.token, params.token)
	})

	if (!inv) throw error(404, 'Invitation not found')
	if (inv.maxUses !== null && inv.useCount >= inv.maxUses)
		throw error(410, 'Invitation use limit reached')
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
			.set({ useCount: sql`${invitation.useCount} + 1` })
			.where(eq(invitation.id, inv.id))
	})

	await pushToTripMembers(
		inv.tripId,
		{
			title: '新成員加入',
			body: `${user.name || user.email} 加入了旅程`,
			url: `/trips/${inv.tripId}/members`
		},
		{ excludeUserId: user.id }
	)

	return json({ tripId: inv.tripId }, { status: 201 })
}
