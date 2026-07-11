import { error } from '@sveltejs/kit'
import { db } from '$lib/server/db'
import { eq, and } from 'drizzle-orm'
import { tripMember } from '$lib/server/db/schema'

export function requireAuth(locals: App.Locals) {
	if (!locals.user) throw error(401, 'Unauthorized')
	return locals.user
}

export async function requireMember(userId: string, tripId: string) {
	const member = await db.query.tripMember.findFirst({
		where: and(eq(tripMember.userId, userId), eq(tripMember.tripId, tripId))
	})
	if (!member) throw error(403, 'Forbidden')
	return member
}

export async function requireAdmin(userId: string, tripId: string) {
	const member = await requireMember(userId, tripId)
	if (member.role === 'member') throw error(403, 'Admin required')
	return member
}
