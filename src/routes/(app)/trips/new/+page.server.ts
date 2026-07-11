import { db } from '$lib/server/db'
import { trip, tripMember } from '$lib/server/db/schema'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions } from './$types'

const currencies = new Set(['TWD', 'JPY', 'USD', 'EUR', 'KRW', 'THB'])

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const formData = await request.formData()
		const name = String(formData.get('name') ?? '').trim()
		const destination = String(formData.get('destination') ?? '').trim()
		const description = String(formData.get('description') ?? '').trim()
		const startDate = String(formData.get('startDate') ?? '').trim()
		const endDate = String(formData.get('endDate') ?? '').trim()
		const requestedCurrency = String(formData.get('currency') ?? 'TWD')
			.trim()
			.toUpperCase()
		const currency = currencies.has(requestedCurrency) ? requestedCurrency : 'TWD'

		const values = { name, destination, description, startDate, endDate, currency }

		if (!name) {
			return fail(400, { message: '請輸入旅程名稱。', values })
		}

		if (startDate && endDate && endDate < startDate) {
			return fail(400, { message: '結束日期必須晚於或等於開始日期。', values })
		}

		const created = await db.transaction(async (tx) => {
			const [newTrip] = await tx
				.insert(trip)
				.values({
					name,
					description: description || null,
					destination: destination || null,
					startDate: startDate || null,
					endDate: endDate || null,
					currency,
					createdBy: locals.user!.id
				})
				.returning()

			await tx.insert(tripMember).values({
				tripId: newTrip.id,
				userId: locals.user!.id,
				role: 'owner'
			})

			return newTrip
		})

		redirect(303, `/trips/${created.id}`)
	}
}
