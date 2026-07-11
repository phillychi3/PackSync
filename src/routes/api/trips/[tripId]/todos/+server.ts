import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { todo } from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const todos = await db.query.todo.findMany({
		where: eq(todo.tripId, params.tripId),
		orderBy: asc(todo.createdAt)
	})

	return json(todos)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (!body.title?.trim()) throw error(400, 'Title is required')

	const [created] = await db
		.insert(todo)
		.values({
			tripId: params.tripId,
			title: body.title,
			assignedTo: body.assignedTo ?? null,
			dueDate: body.dueDate ?? null
		})
		.returning()

	return json(created, { status: 201 })
}
