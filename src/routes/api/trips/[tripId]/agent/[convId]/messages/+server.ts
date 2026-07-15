import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { env } from '$env/dynamic/private'
import { db } from '$lib/server/db'
import {
	agentAction,
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
import { asc, eq, inArray } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'
import { describeAction, summarizeAction } from '$lib/server/agent-actions'
import OpenAI from 'openai'

const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
	{
		type: 'function',
		function: {
			name: 'create_itinerary',
			description:
				'提出「新增行程」的變更提案。提案需要使用者確認後才會寫入。只有使用者明確要求新增、安排或加入行程時才使用。',
			parameters: {
				type: 'object',
				properties: {
					date: { type: 'string', description: '日期，格式 YYYY-MM-DD' },
					title: { type: 'string', description: '行程標題' },
					startTime: { type: ['string', 'null'], description: '開始時間 HH:mm' },
					endTime: { type: ['string', 'null'], description: '結束時間 HH:mm' },
					notes: { type: ['string', 'null'], description: '行程備註' },
					placeName: {
						type: ['string', 'null'],
						description: '要連結的地點名稱（會對應到旅程已儲存的地點）'
					},
					transportMode: {
						type: ['string', 'null'],
						enum: ['walk', 'transit', 'drive', 'flight', 'boat', null],
						description: '前往方式'
					},
					order: { type: ['number', 'null'], description: '同一天內的排序（小的在前）' }
				},
				required: [
					'date',
					'title',
					'startTime',
					'endTime',
					'notes',
					'placeName',
					'transportMode',
					'order'
				],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'import_itinerary',
			description:
				'提出「批次匯入多筆行程」的單一變更提案。當使用者要求一次規劃或匯入整天、多天的完整行程時使用，不要拆成多個 create_itinerary。',
			parameters: {
				type: 'object',
				properties: {
					items: {
						type: 'array',
						description: '要匯入的行程清單，依時間排序',
						items: {
							type: 'object',
							properties: {
								date: { type: 'string', description: '日期 YYYY-MM-DD' },
								title: { type: 'string', description: '行程標題' },
								startTime: { type: ['string', 'null'], description: '開始時間 HH:mm' },
								endTime: { type: ['string', 'null'], description: '結束時間 HH:mm' },
								notes: { type: ['string', 'null'], description: '備註' },
								placeName: { type: ['string', 'null'], description: '地點名稱' },
								transportMode: {
									type: ['string', 'null'],
									enum: ['walk', 'transit', 'drive', 'flight', 'boat', null],
									description: '前往方式'
								},
								order: { type: ['number', 'null'], description: '同一天內的排序' }
							},
							required: [
								'date',
								'title',
								'startTime',
								'endTime',
								'notes',
								'placeName',
								'transportMode',
								'order'
							],
							additionalProperties: false
						}
					}
				},
				required: ['items'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'update_itinerary',
			description:
				'提出「修改既有行程」的變更提案。id 請使用行程安排清單中的 id。只填要變更的欄位，其餘傳 null。可用 order 調整同一天內的順序。',
			parameters: {
				type: 'object',
				properties: {
					id: { type: 'string', description: '要修改的行程 id' },
					date: { type: ['string', 'null'], description: '新日期 YYYY-MM-DD' },
					startTime: { type: ['string', 'null'], description: '新開始時間 HH:mm' },
					endTime: { type: ['string', 'null'], description: '新結束時間 HH:mm' },
					title: { type: ['string', 'null'], description: '新標題' },
					notes: { type: ['string', 'null'], description: '新備註' },
					transportMode: {
						type: ['string', 'null'],
						enum: ['walk', 'transit', 'drive', 'flight', 'boat', null],
						description: '新前往方式'
					},
					order: { type: ['number', 'null'], description: '新排序（小的在前）' }
				},
				required: [
					'id',
					'date',
					'startTime',
					'endTime',
					'title',
					'notes',
					'transportMode',
					'order'
				],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'delete_itinerary',
			description: '提出「刪除既有行程」的變更提案。id 請使用行程安排清單中的 id。',
			parameters: {
				type: 'object',
				properties: {
					id: { type: 'string', description: '要刪除的行程 id' }
				},
				required: ['id'],
				additionalProperties: false
			}
		}
	},
	{
		type: 'function',
		function: {
			name: 'create_todo',
			description: '提出「新增待辦事項」的變更提案。提案需要使用者確認後才會寫入。',
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
			description: '提出「新增出發前需確認的重要物品」的變更提案。提案需要使用者確認後才會寫入。',
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
	},
	{
		type: 'function',
		function: {
			name: 'search_place',
			description:
				'搜尋真實地點的名稱、地址、座標，以及可取得時的營業時間、網站、電話（OpenStreetMap 資料）。查詢地點資訊或使用者想加入新景點時使用，不需要使用者確認。',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: '地點關鍵字，例如「淺草寺」' }
				},
				required: ['query'],
				additionalProperties: false
			}
		}
	}
]

const PROPOSAL_TOOLS = new Set([
	'create_itinerary',
	'import_itinerary',
	'update_itinerary',
	'delete_itinerary',
	'create_todo',
	'create_critical_item'
])

async function searchPlace(query: string) {
	try {
		const upstream = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&extratags=1`,
			{
				headers: {
					'User-Agent': 'PackSync/1.0 travel-planning-app',
					'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
				}
			}
		)
		if (!upstream.ok) return { success: false, error: '地點搜尋服務暫時無法使用' }
		const results = (await upstream.json()) as {
			display_name: string
			lat: string
			lon: string
			name?: string
			extratags?: Record<string, string> | null
		}[]
		return {
			success: true,
			results: results.map((r) => ({
				name: r.name?.trim() || r.display_name.split(',')[0].trim(),
				address: r.display_name,
				lat: parseFloat(r.lat),
				lng: parseFloat(r.lon),
				openingHours: r.extratags?.opening_hours ?? null,
				website: r.extratags?.website ?? null,
				phone: r.extratags?.phone ?? null
			}))
		}
	} catch {
		return { success: false, error: '地點搜尋失敗' }
	}
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
${places.length ? places.map((p) => `- ${p.name}${p.address ? ` (${p.address})` : ''}${p.category ? ` [${p.category}]` : ''}${p.openingHours ? ` 營業:${p.openingHours}` : ''}${p.rating !== null ? ` 評價:${p.rating}${p.ratingCount !== null ? `(${p.ratingCount})` : ''}` : ''}`).join('\n') : '尚無景點'}

## 行程安排
${schedule.length ? schedule.map((s) => `- [id:${s.id}] ${s.date} ${s.startTime ?? ''} ${s.title}${s.transportMode ? ` [${s.transportMode}]` : ''}${s.notes ? ` — ${s.notes}` : ''} (order:${s.order})`).join('\n') : '尚無行程'}

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

	const requestMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
		...history,
		{ role: 'user', content: body.content }
	]
	let aiContent = '抱歉，無法生成回應。'
	const stagedActionIds: string[] = []

	for (let round = 0; round < 4; round += 1) {
		const completion = await client.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `你是一個旅行助理，專門幫助旅行團解答問題、規劃行程、查詢費用等。回答請使用繁體中文 Markdown。

當使用者要求新增、修改或刪除資料時，使用對應工具建立「變更提案」。提案不會立即寫入，使用者會在介面上看到提案卡片並自行按下確認。你的回覆中要簡短說明提案內容，並提醒使用者確認，不要宣稱變更已完成。一次規劃多筆行程時請用 import_itinerary 建立單一批次提案。search_place 工具可即時查詢真實地點（含營業時間，若 OpenStreetMap 有收錄），不需要確認。不要捏造工具執行結果。

以下是本次旅行的相關資料：\n\n${tripContext}`
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
			let result: unknown
			if (toolCall.function.name === 'search_place') {
				let query: string
				try {
					query = String(
						(JSON.parse(toolCall.function.arguments) as Record<string, unknown>).query ?? ''
					)
				} catch {
					query = ''
				}
				result = query ? await searchPlace(query) : { success: false, error: '缺少查詢關鍵字' }
			} else if (PROPOSAL_TOOLS.has(toolCall.function.name)) {
				let args: Record<string, unknown> | null
				try {
					args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>
				} catch {
					args = null
				}
				if (!args) {
					result = { success: false, error: '工具參數不是有效 JSON' }
				} else {
					const [staged] = await db
						.insert(agentAction)
						.values({
							tripId: params.tripId,
							conversationId: params.convId,
							tool: toolCall.function.name,
							args: JSON.stringify(args)
						})
						.returning()
					stagedActionIds.push(staged.id)
					result = {
						success: true,
						staged: true,
						summary: summarizeAction(toolCall.function.name, args),
						note: '已建立變更提案，等待使用者在介面上確認後才會寫入。'
					}
				}
			} else {
				result = { success: false, error: `不支援的工具：${toolCall.function.name}` }
			}
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

	let proposals: ReturnType<typeof describeAction>[] = []
	if (stagedActionIds.length > 0) {
		const staged = await db
			.update(agentAction)
			.set({ messageId: assistantMsg.id })
			.where(inArray(agentAction.id, stagedActionIds))
			.returning()
		proposals = staged.map(describeAction)
	}

	if (conv.messages.length === 0) {
		const title = body.content.slice(0, 30) + (body.content.length > 30 ? '…' : '')
		await db.update(conversation).set({ title }).where(eq(conversation.id, params.convId))
	}

	return json({ userMessage: userMsg, assistantMessage: assistantMsg, proposals }, { status: 201 })
}
