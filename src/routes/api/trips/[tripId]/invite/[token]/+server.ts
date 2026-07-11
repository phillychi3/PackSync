import { error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { invitation } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { requireAuth, requireAdmin } from '$lib/server/api'

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireAdmin(user.id, params.tripId)

	const inv = await db.query.invitation.findFirst({
		where: and(eq(invitation.tripId, params.tripId), eq(invitation.token, params.token))
	})
	if (!inv) throw error(404, 'Invitation not found')

	await db.delete(invitation).where(eq(invitation.id, inv.id))
	return new Response(null, { status: 204 })
}
