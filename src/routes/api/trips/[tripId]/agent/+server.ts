import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { conversation } from '$lib/server/db/schema'
import { and, desc, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const conversations = await db.query.conversation.findMany({
		where: and(eq(conversation.tripId, params.tripId), eq(conversation.userId, user.id)),
		orderBy: [desc(conversation.updatedAt)]
	})

	return json(conversations)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))

	const [created] = await db
		.insert(conversation)
		.values({
			tripId: params.tripId,
			userId: user.id,
			title: body.title ?? '新對話'
		})
		.returning()

	return json(created, { status: 201 })
}
