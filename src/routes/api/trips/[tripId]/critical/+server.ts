import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { criticalItem } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const items = await db.query.criticalItem.findMany({
		where: eq(criticalItem.tripId, params.tripId),
		with: {
			scheduleItem: true,
			confirmations: {
				with: { scheduleItem: true }
			}
		}
	})

	return json(items)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (!body.name?.trim()) throw error(400, 'Name is required')

	const [created] = await db
		.insert(criticalItem)
		.values({
			tripId: params.tripId,
			name: body.name,
			description: body.description ?? null,
			icon: body.icon ?? null,
			scheduleItemId: null
		})
		.returning()

	return json(created, { status: 201 })
}
