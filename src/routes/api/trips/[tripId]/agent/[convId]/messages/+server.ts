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

	const history = conv.messages.map((m) => ({
		role: m.role as 'user' | 'assistant',
		content: m.content
	}))

	const completion = await client.chat.completions.create({
		model: 'gpt-4o-mini',
		messages: [
			{
				role: 'system',
				content: `你是一個旅行助理，專門幫助旅行團解答問題、規劃行程、查詢費用等。以下是本次旅行的相關資料，請根據這些資料回答用戶問題。回答請使用繁體中文。\n\n${tripContext}`
			},
			...history,
			{ role: 'user', content: body.content }
		]
	})

	const aiContent = completion.choices[0]?.message?.content ?? '抱歉，無法生成回應。'

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
