import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { packingItem, packingList } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

async function verifyList(tripId: string, listId: string) {
	const list = await db.query.packingList.findFirst({
		where: eq(packingList.id, listId)
	})
	if (!list || list.tripId !== tripId) throw error(404, 'Packing list not found')
	return list
}

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)
	await verifyList(params.tripId, params.listId)

	const items = await db.query.packingItem.findMany({
		where: eq(packingItem.listId, params.listId)
	})

	return json(items)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)
	await verifyList(params.tripId, params.listId)

	const body = await request.json()
	if (!body.name?.trim()) throw error(400, 'Name is required')

	const [created] = await db
		.insert(packingItem)
		.values({
			listId: params.listId,
			name: body.name,
			quantity: body.quantity ?? 1,
			notes: body.notes ?? null
		})
		.returning()

	return json(created, { status: 201 })
}
