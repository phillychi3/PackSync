import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { notificationPreference } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'

const DEFAULTS = {
	remindItinerary: true,
	remindCritical: true,
	remindBills: true,
	remindTodos: true,
	leadHours: 24
}

export const GET: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals)
	const found = await db.query.notificationPreference.findFirst({
		where: eq(notificationPreference.userId, user.id)
	})
	if (!found) return json(DEFAULTS)
	return json({
		remindItinerary: found.remindItinerary,
		remindCritical: found.remindCritical,
		remindBills: found.remindBills,
		remindTodos: found.remindTodos,
		leadHours: found.leadHours
	})
}

export const PUT: RequestHandler = async ({ locals, request }) => {
	const user = requireAuth(locals)
	const body = await request.json()
	const values = {
		remindItinerary: Boolean(body.remindItinerary ?? DEFAULTS.remindItinerary),
		remindCritical: Boolean(body.remindCritical ?? DEFAULTS.remindCritical),
		remindBills: Boolean(body.remindBills ?? DEFAULTS.remindBills),
		remindTodos: Boolean(body.remindTodos ?? DEFAULTS.remindTodos),
		leadHours: Math.min(Math.max(Number(body.leadHours) || DEFAULTS.leadHours, 1), 168)
	}

	const [saved] = await db
		.insert(notificationPreference)
		.values({ userId: user.id, ...values })
		.onConflictDoUpdate({ target: notificationPreference.userId, set: values })
		.returning()

	return json({
		remindItinerary: saved.remindItinerary,
		remindCritical: saved.remindCritical,
		remindBills: saved.remindBills,
		remindTodos: saved.remindTodos,
		leadHours: saved.leadHours
	})
}
