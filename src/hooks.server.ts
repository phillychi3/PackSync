import { json, type Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { building } from '$app/environment'
import { auth } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { idempotencyKey } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { svelteKitHandler } from 'better-auth/svelte-kit'

// 離線佇列重送的 POST 會帶 x-idempotency-key，重複的 key 直接略過避免建立重複資料
const handleIdempotency: Handle = async ({ event, resolve }) => {
	const key = event.request.headers.get('x-idempotency-key')
	if (!key || event.request.method !== 'POST' || !event.url.pathname.startsWith('/api/')) {
		return resolve(event)
	}
	const existing = await db.query.idempotencyKey.findFirst({
		where: eq(idempotencyKey.key, key)
	})
	if (existing) return json({ duplicate: true })

	const response = await resolve(event)
	if (response.status < 400) {
		await db.insert(idempotencyKey).values({ key }).onConflictDoNothing()
	}
	return response
}

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const session = await auth.api.getSession({ headers: event.request.headers })

	if (session) {
		event.locals.session = session.session
		event.locals.user = session.user
	}

	return svelteKitHandler({ event, resolve, auth, building })
}

export const handle: Handle = sequence(handleIdempotency, handleBetterAuth)
