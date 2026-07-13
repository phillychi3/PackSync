import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { db } from '$lib/server/db'
import { pushSubscription } from '$lib/server/db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '$lib/server/api'
import { sendWebPush, webPushConfigured } from '$lib/server/push'

export const POST: RequestHandler = async ({ locals }) => {
	const user = requireAuth(locals)
	if (!webPushConfigured) throw error(503, 'Web Push is not configured')
	const subscriptions = await db.query.pushSubscription.findMany({
		where: eq(pushSubscription.userId, user.id)
	})
	for (const subscription of subscriptions) {
		try {
			await sendWebPush(subscription, {
				title: 'PackSync 通知測試',
				body: 'Web Push 已成功連線。',
				url: '/trips'
			})
		} catch (error) {
			if (
				(error as { statusCode?: number }).statusCode === 404 ||
				(error as { statusCode?: number }).statusCode === 410
			) {
				await db.delete(pushSubscription).where(eq(pushSubscription.id, subscription.id))
			}
		}
	}
	return json({ sent: subscriptions.length })
}
