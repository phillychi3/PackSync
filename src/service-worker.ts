/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return
	const url = new URL(event.request.url)
	const shouldCache = event.request.mode === 'navigate' || url.pathname.startsWith('/api/trips/')
	if (!shouldCache) return

	event.respondWith(
		(async () => {
			const cache = await caches.open('packsync-offline-v1')
			try {
				const response = await fetch(event.request)
				if (response.ok) await cache.put(event.request, response.clone())
				return response
			} catch {
				const cached = await cache.match(event.request)
				if (cached) return cached
				throw new Error('Offline response unavailable')
			}
		})()
	)
})

self.addEventListener('push', (event) => {
	let payload: { title?: string; body?: string; url?: string } = {}
	try {
		payload = event.data?.json() ?? {}
	} catch {
		payload = { body: event.data?.text() }
	}

	event.waitUntil(
		self.registration.showNotification(payload.title ?? 'PackSync 通知', {
			body: payload.body ?? '你有一則新的旅程通知。',
			icon: '/pwa-192x192.png',
			badge: '/pwa-64x64.png',
			data: { url: payload.url ?? '/trips' }
		})
	)
})

self.addEventListener('notificationclick', (event) => {
	event.notification.close()
	const url = event.notification.data?.url ?? '/trips'
	event.waitUntil(self.clients.openWindow(url))
})
