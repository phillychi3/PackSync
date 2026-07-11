import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { todo } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const [updated] = await db
		.update(todo)
		.set({
			...(body.title !== undefined && { title: body.title }),
			...(body.assignedTo !== undefined && { assignedTo: body.assignedTo }),
			...(body.dueDate !== undefined && { dueDate: body.dueDate }),
			...(body.isCompleted !== undefined && { isCompleted: body.isCompleted })
		})
		.where(eq(todo.id, params.todoId))
		.returning()

	if (!updated || updated.tripId !== params.tripId) throw error(404, 'Todo not found')
	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.todo.findFirst({
		where: eq(todo.id, params.todoId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Todo not found')

	await db.delete(todo).where(eq(todo.id, params.todoId))
	return new Response(null, { status: 204 })
}
