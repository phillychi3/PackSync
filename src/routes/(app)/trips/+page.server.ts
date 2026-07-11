import { db } from '$lib/server/db'
import { tripMember } from '$lib/server/db/schema'
import { desc, eq } from 'drizzle-orm'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const memberships = await db.query.tripMember.findMany({
		where: eq(tripMember.userId, locals.user!.id),
		orderBy: desc(tripMember.joinedAt),
		with: { trip: true }
	})

	return {
		trips: memberships.map((membership) => ({
			...membership.trip,
			role: membership.role,
			joinedAt: membership.joinedAt
		}))
	}
}
