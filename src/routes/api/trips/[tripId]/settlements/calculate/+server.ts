import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireAuth, requireMember, calculateSettlements } from '$lib/server/api'

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	return json(await calculateSettlements(params.tripId))
}
