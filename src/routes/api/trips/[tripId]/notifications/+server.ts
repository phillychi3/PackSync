import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { notificationRead } from '$lib/server/db/schema'
import { and, eq, inArray } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'
import { buildNotifications } from '$lib/server/notifications'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const items = await buildNotifications(params.tripId, user.id)
	const keys = items.map((item) => item.key)
	const reads =
		keys.length > 0
			? await db.query.notificationRead.findMany({
					where: and(eq(notificationRead.userId, user.id), inArray(notificationRead.key, keys))
				})
			: []

	return json({ items, readKeys: reads.map((read) => read.key) })
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))
	const keys: string[] = Array.isArray(body.keys)
		? body.keys.filter((key: unknown) => typeof key === 'string')
		: []
	if (keys.length === 0) throw error(400, 'keys is required')

	await db
		.insert(notificationRead)
		.values(keys.map((key) => ({ userId: user.id, key })))
		.onConflictDoNothing()

	return json({ ok: true })
}
