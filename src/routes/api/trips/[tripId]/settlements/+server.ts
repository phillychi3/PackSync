import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { settlement } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import {
	addSettlementDetails,
	rebuildSettlements,
	requireAuth,
	requireMember
} from '$lib/server/api'

const userColumns = { id: true, name: true, email: true, image: true } as const

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const settlements = await db.query.settlement.findMany({
		where: eq(settlement.tripId, params.tripId),
		with: {
			fromUser: { columns: userColumns },
			toUser: { columns: userColumns }
		}
	})

	return json(await addSettlementDetails(params.tripId, settlements))
}

export const POST: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	return json(await rebuildSettlements(params.tripId))
}
