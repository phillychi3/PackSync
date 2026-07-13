import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { bill, billPayer, billParticipant, billItem, settlement } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth, requireMember } from '$lib/server/api'

const userColumns = { id: true, name: true, email: true, image: true } as const

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.bill.findFirst({
		where: eq(bill.id, params.billId),
		with: {
			payers: { with: { user: { columns: userColumns } } },
			participants: { with: { user: { columns: userColumns } } },
			items: true
		}
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Bill not found')

	return json(found)
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const body = await request.json()

	const existing = await db.query.bill.findFirst({
		where: eq(bill.id, params.billId),
		with: { payers: true }
	})
	if (!existing || existing.tripId !== params.tripId) throw error(404, 'Bill not found')
	const nextAmount = body.amount ?? existing.amount
	const nextPayers = body.payers ?? existing.payers
	const payerTotal = nextPayers.reduce(
		(sum: number, payer: { amount?: number }) => sum + (Number(payer.amount) || 0),
		0
	)
	if (Math.abs(payerTotal - nextAmount) > 0.01)
		throw error(400, 'Payer total must equal bill amount')

	const updated = await db.transaction(async (tx) => {
		const [updatedBill] = await tx
			.update(bill)
			.set({
				...(body.title !== undefined && { title: body.title }),
				...(body.amount !== undefined && { amount: body.amount }),
				...(body.currency !== undefined && { currency: body.currency }),
				...(body.category !== undefined && { category: body.category }),
				...(body.date !== undefined && { date: body.date }),
				...(body.splitMethod !== undefined && { splitMethod: body.splitMethod }),
				...(body.notes !== undefined && { notes: body.notes })
			})
			.where(eq(bill.id, params.billId))
			.returning()

		if (body.payers) {
			await tx.delete(billPayer).where(eq(billPayer.billId, params.billId))
			await tx.insert(billPayer).values(
				body.payers.map((p: { userId: string; amount: number }) => ({
					billId: params.billId,
					userId: p.userId,
					amount: p.amount
				}))
			)
		}

		if (body.participants) {
			await tx.delete(billParticipant).where(eq(billParticipant.billId, params.billId))
			await tx.insert(billParticipant).values(
				body.participants.map((p: { userId: string; value?: number }) => ({
					billId: params.billId,
					userId: p.userId,
					value: p.value ?? null
				}))
			)
		}

		if (body.items !== undefined) {
			await tx.delete(billItem).where(eq(billItem.billId, params.billId))
			if (Array.isArray(body.items) && body.items.length > 0) {
				await tx.insert(billItem).values(
					body.items.map(
						(i: { name: string; amount: number; notes?: string; participants?: string[] }) => ({
							billId: params.billId,
							name: i.name,
							amount: i.amount,
							notes: i.notes ?? null,
							participants: i.participants ? JSON.stringify(i.participants) : null
						})
					)
				)
			}
		}

		await tx.delete(settlement).where(eq(settlement.billId, params.billId))

		return updatedBill
	})

	return json(updated)
}

export const DELETE: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const found = await db.query.bill.findFirst({
		where: eq(bill.id, params.billId)
	})
	if (!found || found.tripId !== params.tripId) throw error(404, 'Bill not found')

	await db.delete(bill).where(eq(bill.id, params.billId))
	return new Response(null, { status: 204 })
}
