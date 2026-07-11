import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { packingList } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const lists = await db.query.packingList.findMany({
		where: eq(packingList.tripId, params.tripId),
		with: { items: true }
	})

	return json(lists)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))

	const [created] = await db
		.insert(packingList)
		.values({
			tripId: params.tripId,
			name: body.name ?? '主要清單'
		})
		.returning()

	return json(created, { status: 201 })
}
