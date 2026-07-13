import webpush from 'web-push'
import { env } from '$env/dynamic/private'

const subject = env.WEB_PUSH_SUBJECT || 'mailto:admin@packsync.local'
const publicKey = env.WEB_PUSH_VAPID_PUBLIC_KEY
const privateKey = env.WEB_PUSH_VAPID_PRIVATE_KEY

export const webPushConfigured = Boolean(publicKey && privateKey)

if (webPushConfigured) {
	webpush.setVapidDetails(subject, publicKey!, privateKey!)
}

export function getWebPushPublicKey() {
	return publicKey || ''
}

export async function sendWebPush(
	subscription: { endpoint: string; p256dh: string; auth: string },
	payload: { title: string; body: string; url?: string }
) {
	if (!webPushConfigured) return false
	await webpush.sendNotification(
		{
			endpoint: subscription.endpoint,
			keys: { p256dh: subscription.p256dh, auth: subscription.auth }
		},
		JSON.stringify(payload)
	)
	return true
}
