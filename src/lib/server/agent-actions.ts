import { db } from '$lib/server/db'
import { agentAction, criticalItem, place, scheduleItem, todo } from '$lib/server/db/schema'
import { and, eq, like } from 'drizzle-orm'

export type AgentActionRow = typeof agentAction.$inferSelect

function parseArgs(action: AgentActionRow): Record<string, unknown> {
	try {
		return JSON.parse(action.args) as Record<string, unknown>
	} catch {
		return {}
	}
}

function str(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value : null
}

export function summarizeAction(tool: string, args: Record<string, unknown>): string {
	switch (tool) {
		case 'create_itinerary':
			return `新增行程：${args.date ?? ''} ${args.startTime ?? ''} ${args.title ?? ''}`.trim()
		case 'update_itinerary': {
			const fields = ['date', 'startTime', 'endTime', 'title', 'notes']
				.filter((key) => str(args[key]) !== null)
				.join('、')
			return `修改行程（${fields || '無變更欄位'}）`
		}
		case 'delete_itinerary':
			return '刪除行程'
		case 'create_todo':
			return `新增待辦：${args.title ?? ''}${args.dueDate ? `（截止 ${args.dueDate}）` : ''}`
		case 'create_critical_item':
			return `新增重要物品：${args.name ?? ''}`
		default:
			return tool
	}
}

export function describeAction(action: AgentActionRow) {
	const args = parseArgs(action)
	return {
		id: action.id,
		messageId: action.messageId,
		tool: action.tool,
		status: action.status,
		summary: summarizeAction(action.tool, args),
		args
	}
}

async function resolvePlaceId(tripId: string, placeName: unknown): Promise<string | null> {
	const name = str(placeName)
	if (!name) return null
	const exact = await db.query.place.findFirst({
		where: and(eq(place.tripId, tripId), eq(place.name, name))
	})
	if (exact) return exact.id
	const fuzzy = await db.query.place.findFirst({
		where: and(eq(place.tripId, tripId), like(place.name, `%${name}%`))
	})
	return fuzzy?.id ?? null
}

/** Executes a proposed action. Returns undo data to persist, or throws with a user-facing message. */
export async function executeAgentAction(action: AgentActionRow): Promise<string> {
	const args = parseArgs(action)

	if (action.tool === 'create_itinerary') {
		const date = str(args.date)
		const title = str(args.title)
		if (!date || !title) throw new Error('提案缺少日期或標題')
		const placeId = await resolvePlaceId(action.tripId, args.placeName)
		const [created] = await db
			.insert(scheduleItem)
			.values({
				tripId: action.tripId,
				date,
				title,
				startTime: str(args.startTime),
				endTime: str(args.endTime),
				notes: str(args.notes),
				placeId,
				order: 0
			})
			.returning()
		return JSON.stringify({ createdId: created.id, table: 'schedule_item' })
	}

	if (action.tool === 'update_itinerary') {
		const id = str(args.id)
		if (!id) throw new Error('提案缺少行程 id')
		const existing = await db.query.scheduleItem.findFirst({
			where: and(eq(scheduleItem.id, id), eq(scheduleItem.tripId, action.tripId))
		})
		if (!existing) throw new Error('找不到要修改的行程，可能已被刪除')
		const previous = {
			date: existing.date,
			startTime: existing.startTime,
			endTime: existing.endTime,
			title: existing.title,
			notes: existing.notes
		}
		await db
			.update(scheduleItem)
			.set({
				...(str(args.date) && { date: str(args.date)! }),
				...(str(args.title) && { title: str(args.title)! }),
				...(str(args.startTime) !== null && { startTime: str(args.startTime) }),
				...(str(args.endTime) !== null && { endTime: str(args.endTime) }),
				...(str(args.notes) !== null && { notes: str(args.notes) })
			})
			.where(eq(scheduleItem.id, id))
		return JSON.stringify({ updatedId: id, previous })
	}

	if (action.tool === 'delete_itinerary') {
		const id = str(args.id)
		if (!id) throw new Error('提案缺少行程 id')
		const existing = await db.query.scheduleItem.findFirst({
			where: and(eq(scheduleItem.id, id), eq(scheduleItem.tripId, action.tripId))
		})
		if (!existing) throw new Error('找不到要刪除的行程，可能已被刪除')
		await db.delete(scheduleItem).where(eq(scheduleItem.id, id))
		return JSON.stringify({ deletedRow: existing })
	}

	if (action.tool === 'create_todo') {
		const title = str(args.title)
		if (!title) throw new Error('提案缺少待辦標題')
		const [created] = await db
			.insert(todo)
			.values({ tripId: action.tripId, title, dueDate: str(args.dueDate) })
			.returning()
		return JSON.stringify({ createdId: created.id, table: 'todo' })
	}

	if (action.tool === 'create_critical_item') {
		const name = str(args.name)
		if (!name) throw new Error('提案缺少重要物品名稱')
		const [created] = await db
			.insert(criticalItem)
			.values({ tripId: action.tripId, name, description: str(args.description) })
			.returning()
		return JSON.stringify({ createdId: created.id, table: 'critical_item' })
	}

	throw new Error(`不支援的工具：${action.tool}`)
}

/** Reverts an executed action using its stored undo data. */
export async function undoAgentAction(action: AgentActionRow): Promise<void> {
	if (!action.undoData) throw new Error('這個變更沒有可用的復原資料')
	const undo = JSON.parse(action.undoData) as Record<string, unknown>

	if (action.tool === 'create_itinerary') {
		await db.delete(scheduleItem).where(eq(scheduleItem.id, String(undo.createdId)))
		return
	}
	if (action.tool === 'create_todo') {
		await db.delete(todo).where(eq(todo.id, String(undo.createdId)))
		return
	}
	if (action.tool === 'create_critical_item') {
		await db.delete(criticalItem).where(eq(criticalItem.id, String(undo.createdId)))
		return
	}
	if (action.tool === 'update_itinerary') {
		const previous = undo.previous as {
			date: string
			startTime: string | null
			endTime: string | null
			title: string
			notes: string | null
		}
		await db
			.update(scheduleItem)
			.set(previous)
			.where(eq(scheduleItem.id, String(undo.updatedId)))
		return
	}
	if (action.tool === 'delete_itinerary') {
		const row = undo.deletedRow as typeof scheduleItem.$inferSelect
		await db.insert(scheduleItem).values({
			id: row.id,
			tripId: row.tripId,
			placeId: row.placeId,
			date: row.date,
			startTime: row.startTime,
			endTime: row.endTime,
			title: row.title,
			notes: row.notes,
			transportMode: row.transportMode,
			order: row.order
		})
		return
	}
	throw new Error(`不支援的工具：${action.tool}`)
}
