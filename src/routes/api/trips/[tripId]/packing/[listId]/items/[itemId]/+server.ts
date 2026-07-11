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
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)
	await verifyList(params.tripId, params.listId)

	const body = await request.json()

	const [updated] = await db
		.update(packingItem)
		.set({
			...(body.name !== undefined && { name: body.name }),
			...(body.category !== undefined && { category: body.category }),
			...(body.quantity !== undefined && { quantity: body.quantity }),
			...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
			...(body.isChecked !== undefined && { isChecked: body.isChecked }),
			...(body.notes !== undefined && { notes: body.notes })
		})
		.where(eq(packingItem.id, params.itemId))
		.returning()

	if (!updated || updated.listId !== params.listId) throw error(404, 'Item not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)
	await verifyList(params.tripId, params.listId)

	const found = await db.query.packingItem.findFirst({
		where: eq(packingItem.id, params.itemId)
	})
	if (!found || found.listId !== params.listId) throw error(404, 'Item not found')

	await db.delete(packingItem).where(eq(packingItem.id, params.itemId))
	return new Response(null, { status: 204 })
}
