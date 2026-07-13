import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { getWebPushPublicKey, webPushConfigured } from '$lib/server/push'

export const GET: RequestHandler = async () => {
	if (!webPushConfigured) throw error(503, 'Web Push is not configured')
	return json({ publicKey: getWebPushPublicKey() })
}
