import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { bill, billPayer, billParticipant } from '$lib/server/db/schema'
import { desc, eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const bills = await db.query.bill.findMany({
		where: eq(bill.tripId, params.tripId),
		with: { payers: true, participants: true },
		orderBy: [desc(bill.date)]
	})

	return json(bills)
}

export const POST: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()
	if (!body.title?.trim()) throw error(400, 'Title is required')
	if (!body.amount || body.amount <= 0) throw error(400, 'Valid amount is required')
	if (!body.date) throw error(400, 'Date is required')
	if (!Array.isArray(body.payers) || body.payers.length === 0)
		throw error(400, 'At least one payer required')
	if (!Array.isArray(body.participants) || body.participants.length === 0)
		throw error(400, 'At least one participant required')

	const created = await db.transaction(async (tx) => {
		const [newBill] = await tx
			.insert(bill)
			.values({
				tripId: params.tripId,
				title: body.title,
				amount: body.amount,
				currency: body.currency ?? 'TWD',
				category: body.category ?? null,
				date: body.date,
				splitMethod: body.splitMethod ?? 'equal',
				notes: body.notes ?? null,
				createdBy: user.id
			})
			.returning()

		await tx.insert(billPayer).values(
			body.payers.map((p: { userId: string; amount: number }) => ({
				billId: newBill.id,
				userId: p.userId,
				amount: p.amount
			}))
		)

		await tx.insert(billParticipant).values(
			body.participants.map((p: { userId: string; value?: number }) => ({
				billId: newBill.id,
				userId: p.userId,
				value: p.value ?? null
			}))
		)

		return newBill
	})

	return json(created, { status: 201 })
}
