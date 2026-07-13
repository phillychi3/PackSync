import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { pushSubscription } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'

export const POST: RequestHandler = async ({ locals, request }) => {
	const user = requireAuth(locals)
	const body = await request.json().catch(() => ({}))
	if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
		throw error(400, 'Invalid push subscription')
	}

	const existing = await db.query.pushSubscription.findFirst({
		where: eq(pushSubscription.endpoint, body.endpoint)
	})
	if (existing) {
		await db
			.update(pushSubscription)
			.set({ userId: user.id, p256dh: body.keys.p256dh, auth: body.keys.auth })
			.where(eq(pushSubscription.id, existing.id))
		return json(existing)
	}

	const [created] = await db
		.insert(pushSubscription)
		.values({
			userId: user.id,
			endpoint: body.endpoint,
			p256dh: body.keys.p256dh,
			auth: body.keys.auth
		})
		.returning()
	return json(created, { status: 201 })
}

export const DELETE: RequestHandler = async ({ locals, request }) => {
	const user = requireAuth(locals)
	const body = await request.json().catch(() => ({}))
	if (body.endpoint) {
		await db.delete(pushSubscription).where(eq(pushSubscription.endpoint, body.endpoint))
	} else {
		await db.delete(pushSubscription).where(eq(pushSubscription.userId, user.id))
	}
	return new Response(null, { status: 204 })
}
