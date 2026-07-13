import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { conversation } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const conv = await db.query.conversation.findFirst({
		where: eq(conversation.id, params.convId),
		with: { messages: true }
	})

	if (!conv || conv.tripId !== params.tripId || conv.userId !== user.id) {
		throw error(404, 'Conversation not found')
	}

	return json(conv)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const conv = await db.query.conversation.findFirst({
		where: eq(conversation.id, params.convId)
	})
	if (!conv || conv.tripId !== params.tripId || conv.userId !== user.id) {
		throw error(404, 'Conversation not found')
	}

	await db.delete(conversation).where(eq(conversation.id, params.convId))
	return new Response(null, { status: 204 })
}
