import { db } from '$lib/server/db'
import { tripMember } from '$lib/server/db/schema'
import { and, eq } from 'drizzle-orm'
import { error } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const membership = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.tripId, params.tripId), eq(tripMember.userId, locals.user!.id)),
		with: { trip: true }
	})

	if (!membership) throw error(404, '找不到這趟旅程')

	return {
		trip: membership.trip,
		role: membership.role,
		user: locals.user!
	}
}
