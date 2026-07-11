import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { packingList } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const list = await db.query.packingList.findFirst({
		where: eq(packingList.id, params.listId),
		with: { items: true }
	})
	if (!list || list.tripId !== params.tripId) throw error(404, 'Packing list not found')

	return json(list)
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const [updated] = await db
		.update(packingList)
		.set({ name: body.name })
		.where(eq(packingList.id, params.listId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Packing list not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.packingList.findFirst({
		where: eq(packingList.id, params.listId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Packing list not found')

	await db.delete(packingList).where(eq(packingList.id, params.listId))
	return new Response(null, { status: 204 })
}
