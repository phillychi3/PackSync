import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { agentAction, conversation } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'
import { describeAction, executeAgentAction, undoAgentAction } from '$lib/server/agent-actions'

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json().catch(() => ({}))
	const decision = body.decision as 'confirm' | 'cancel' | 'undo'
	if (!['confirm', 'cancel', 'undo'].includes(decision)) throw error(400, 'Invalid decision')

	const action = await db.query.agentAction.findFirst({
		where: eq(agentAction.id, params.actionId)
	})
	if (!action || action.tripId !== params.tripId) throw error(404, 'Action not found')

	const conv = await db.query.conversation.findFirst({
		where: eq(conversation.id, action.conversationId)
	})
	if (!conv || conv.userId !== user.id) throw error(403, 'Forbidden')

	if (decision === 'confirm') {
		if (action.status !== 'proposed') throw error(409, '這個提案已處理過')
		let undoData: string
		try {
			undoData = await executeAgentAction(action)
		} catch (err) {
			throw error(422, err instanceof Error ? err.message : '執行提案失敗')
		}
		const [updated] = await db
			.update(agentAction)
			.set({ status: 'executed', undoData })
			.where(eq(agentAction.id, action.id))
			.returning()
		return json(describeAction(updated))
	}

	if (decision === 'cancel') {
		if (action.status !== 'proposed') throw error(409, '這個提案已處理過')
		const [updated] = await db
			.update(agentAction)
			.set({ status: 'cancelled' })
			.where(eq(agentAction.id, action.id))
			.returning()
		return json(describeAction(updated))
	}

	if (action.status !== 'executed') throw error(409, '只有已執行的變更可以復原')
	try {
		await undoAgentAction(action)
	} catch (err) {
		throw error(422, err instanceof Error ? err.message : '復原失敗')
	}
	const [updated] = await db
		.update(agentAction)
		.set({ status: 'undone' })
		.where(eq(agentAction.id, action.id))
		.returning()
	return json(describeAction(updated))
}
