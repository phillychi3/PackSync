import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { user } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'

export const PUT: RequestHandler = async ({ locals, request }) => {
	const me = requireAuth(locals)
	const body = await request.json()

	const name = typeof body.name === 'string' ? body.name.trim() : undefined
	const image = typeof body.image === 'string' ? body.image.trim() || null : undefined
	if (name !== undefined && name.length === 0) throw error(400, 'Name cannot be empty')
	if (name === undefined && image === undefined) throw error(400, 'Nothing to update')

	const [updated] = await db
		.update(user)
		.set({
			...(name !== undefined && { name }),
			...(image !== undefined && { image })
		})
		.where(eq(user.id, me.id))
		.returning()

	return json({ id: updated.id, name: updated.name, email: updated.email, image: updated.image })
}
