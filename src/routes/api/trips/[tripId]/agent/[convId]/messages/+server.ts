import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db'
import {
	bill,
	conversation,
	message,
	place,
	scheduleItem,
	todo,
	criticalItem,
	tripMember,
	user
} from '$lib/server/db/schema'
import { asc, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'
import OpenAI from 'openai'

const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'create_itinerary',
			description: '在目前旅程新增一個行程。只有使用者明確要求新增、安排或加入行程時才使用。',
			parameters: {
				type: 'object',
				properties: {
					date: { type: 'string', description: '日期，格式 YYYY-MM-DD' },
					title: { type: 'string', description: '行程標題' },
					startTime: { type: ['string', 'null'], description: '開始時間 HH:mm' },
					endTime: { type: ['string', 'null'], description: '結束時間 HH:mm' },
					notes: { type: ['string', 'null'], description: '行程備註' }
				},
				required: ['date', 'title', 'startTime', 'endTime', 'notes'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'create_todo',
			description: '在目前旅程新增待辦事項。',
			parameters: {
				type: 'object',
				properties: {
					title: { type: 'string', description: '待辦標題' },
					dueDate: { type: ['string', 'null'], description: '截止日期 YYYY-MM-DD' }
				},
				required: ['title', 'dueDate'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'create_critical_item',
			description: '在目前旅程新增需要出發前確認的重要物品。',
			parameters: {
				type: 'object',
				properties: {
					name: { type: 'string', description: '重要物品名稱，例如護照' },
					description: { type: ['string', 'null'], description: '補充說明' }
				},
				required: ['name', 'description'],
				additionalProperties: false
			}
		}
	}
]

async function executeTool(tripId: string, name: string, rawArguments: string) {
	let args: Record<string, unknown>
	try {
		args = JSON.parse(rawArguments) as Record<string, unknown>
	} catch {
		return { success: false, error: '工具參數不是有效 JSON' }
	}

	if (name === 'create_itinerary') {
		if (typeof args.date !== 'string' || typeof args.title !== 'string' || !args.title.trim()) {
			return { success: false, error: '新增行程需要 date 與 title' }
		}
		const [created] = await db
			.insert(scheduleItem)
			.values({
				tripId,
				date: args.date,
				title: args.title,
				startTime: typeof args.startTime === 'string' ? args.startTime : null,
				endTime: typeof args.endTime === 'string' ? args.endTime : null,
				notes: typeof args.notes === 'string' ? args.notes : null,
				order: 0
			})
			.returning()
		return { success: true, action: '新增行程', item: created }
	}

	if (name === 'create_todo') {
		if (typeof args.title !== 'string' || !args.title.trim()) {
			return { success: false, error: '新增待辦需要 title' }
		}
		const [created] = await db
			.insert(todo)
			.values({
				tripId,
				title: args.title,
				dueDate: typeof args.dueDate === 'string' ? args.dueDate : null
			})
			.returning()
		return { success: true, action: '新增待辦', item: created }
	}

	if (name === 'create_critical_item') {
		if (typeof args.name !== 'string' || !args.name.trim()) {
			return { success: false, error: '新增重要物品需要 name' }
		}
		const [created] = await db
			.insert(criticalItem)
			.values({
				tripId,
				name: args.name,
				description: typeof args.description === 'string' ? args.description : null
			})
			.returning()
		return { success: true, action: '新增重要物品', item: created }
	}

	return { success: false, error: `不支援的工具：${name}` }
}

async function buildTripContext(tripId: string) {
	const [places, schedule, bills, todos, criticals, members] = await Promise.all([
		db.query.place.findMany({ where: eq(place.tripId, tripId) }),
		db.query.scheduleItem.findMany({
			where: eq(scheduleItem.tripId, tripId),
			orderBy: [asc(scheduleItem.date), asc(scheduleItem.order)]
		}),
		db.query.bill.findMany({
			where: eq(bill.tripId, tripId),
			with: { payers: true, participants: true }
		}),
		db.query.todo.findMany({ where: eq(todo.tripId, tripId) }),
		db.query.criticalItem.findMany({
			where: eq(criticalItem.tripId, tripId),
			with: { confirmations: true }
		}),
		db
			.select({ userId: tripMember.userId, role: tripMember.role, name: user.name })
			.from(tripMember)
			.innerJoin(user, eq(tripMember.userId, user.id))
			.where(eq(tripMember.tripId, tripId))
	])

	return `
## 旅行成員
${members.map((m) => `- ${m.name} (${m.role})`).join('\n')}

## 景點列表
${places.length ? places.map((p) => `- ${p.name}${p.address ? ` (${p.address})` : ''}${p.category ? ` [${p.category}]` : ''}`).join('\n') : '尚無景點'}

## 行程安排
${schedule.length ? schedule.map((s) => `- ${s.date} ${s.startTime ?? ''} ${s.title}${s.notes ? ` — ${s.notes}` : ''}`).join('\n') : '尚無行程'}

## 帳單
${bills.length ? bills.map((b) => `- ${b.date} ${b.title} ${b.amount} ${b.currency} (${b.splitMethod})`).join('\n') : '尚無帳單'}

## 待辦事項
${todos.length ? todos.map((t) => `- [${t.isCompleted ? 'x' : ' '}] ${t.title}${t.dueDate ? ` (due: ${t.dueDate})` : ''}`).join('\n') : '尚無待辦'}

## 重要物品
${criticals.length ? criticals.map((c) => `- ${c.name}${c.description ? `: ${c.description}` : ''} (${c.confirmations.length} 人已確認)`).join('\n') : '尚無重要物品'}
`.trim()
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const authUser = requireAuth(locals)
	await requireMember(authUser.id, params.tripId)

	if (!env.OPENAI_API_KEY) throw error(503, 'AI service not configured')

	const conv = await db.query.conversation.findFirst({
		where: eq(conversation.id, params.convId),
		with: { messages: { orderBy: asc(message.createdAt) } }
	})
	if (!conv || conv.tripId !== params.tripId || conv.userId !== authUser.id) {
		throw error(404, 'Conversation not found')
	}

	const body = await request.json()
	if (!body.content?.trim()) throw error(400, 'Content is required')

	const [userMsg] = await db
		.insert(message)
		.values({ conversationId: params.convId, role: 'user', content: body.content })
		.returning()

	const tripContext = await buildTripContext(params.tripId)
	const client = new OpenAI({ apiKey: env.OPENAI_API_KEY })

	const history: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = conv.messages.map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}))

	let requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
		...history,
		{ role: 'user', content: body.content }
	]
	let aiContent = '抱歉，無法生成回應。'

	for (let round = 0; round < 4; round += 1) {
		const completion = await client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `你是一個旅行助理，專門幫助旅行團解答問題、規劃行程、查詢費用等。回答請使用繁體中文 Markdown。當使用者明確要求新增行程、待辦或重要物品時，使用對應工具完成操作；不要捏造工具執行結果。以下是本次旅行的相關資料：\n\n${tripContext}`
				},
				...requestMessages
			],
			tools: agentTools,
			tool_choice: 'auto'
		})
		const assistant = completion.choices[0]?.message
		if (!assistant) break
		requestMessages.push(assistant)
		if (!assistant.tool_calls?.length) {
			aiContent = assistant.content ?? aiContent
			break
		}
		for (const toolCall of assistant.tool_calls) {
			if (toolCall.type !== 'function') continue
			const result = await executeTool(
				params.tripId,
				toolCall.function.name,
				toolCall.function.arguments
			)
			requestMessages.push({
				role: 'tool',
				tool_call_id: toolCall.id,
				content: JSON.stringify(result)
			})
		}
	}

	const [assistantMsg] = await db
		.insert(message)
		.values({ conversationId: params.convId, role: 'assistant', content: aiContent })
		.returning()

	if (conv.messages.length === 0) {
		const title = body.content.slice(0, 30) + (body.content.length > 30 ? '…' : '')
		await db.update(conversation).set({ title }).where(eq(conversation.id, params.convId))
	}

	return json({ userMessage: userMsg, assistantMessage: assistantMsg }, { status: 201 })
}
