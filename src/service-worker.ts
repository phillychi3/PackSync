/// <reference lib="webworker" />

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
	__WB_MANIFEST: Array<{ revision: string | null; url: string }>
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// ─── Offline outbox：離線時暫存修改／刪除，恢復連線後重送 ─────────────────────

type OutboxEntry = {
	id?: number
	url: string
	method: string
	contentType: string
	body: string
	ts: number
}

const OUTBOX_DB = 'packsync-outbox'
const OUTBOX_STORE = 'requests'
const QUEUEABLE_METHODS = ['PUT', 'PATCH', 'DELETE']
const OFFLINE_CACHE = 'packsync-offline-v1'

function openOutbox(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(OUTBOX_DB, 1)
		request.onupgradeneeded = () => {
			request.result.createObjectStore(OUTBOX_STORE, { keyPath: 'id', autoIncrement: true })
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function outboxAll(): Promise<OutboxEntry[]> {
	const dbInstance = await openOutbox()
	return new Promise((resolve, reject) => {
		const request = dbInstance
			.transaction(OUTBOX_STORE, 'readonly')
			.objectStore(OUTBOX_STORE)
			.getAll()
		request.onsuccess = () => resolve(request.result as OutboxEntry[])
		request.onerror = () => reject(request.error)
	})
}

async function outboxAdd(entry: OutboxEntry): Promise<void> {
	const existing = await outboxAll()
	const duplicate = existing.some(
		(item) => item.url === entry.url && item.method === entry.method && item.body === entry.body
	)
	if (duplicate) return
	const dbInstance = await openOutbox()
	return new Promise((resolve, reject) => {
		const request = dbInstance
			.transaction(OUTBOX_STORE, 'readwrite')
			.objectStore(OUTBOX_STORE)
			.add(entry)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

async function outboxDelete(id: number): Promise<void> {
	const dbInstance = await openOutbox()
	return new Promise((resolve, reject) => {
		const request = dbInstance
			.transaction(OUTBOX_STORE, 'readwrite')
			.objectStore(OUTBOX_STORE)
			.delete(id)
		request.onsuccess = () => resolve()
		request.onerror = () => reject(request.error)
	})
}

async function replayOutbox() {
	const entries = await outboxAll()
	if (entries.length === 0) return
	let flushed = 0
	for (const entry of entries.sort((a, b) => a.ts - b.ts)) {
		try {
			await fetch(entry.url, {
				method: entry.method,
				headers: entry.body ? { 'content-type': entry.contentType } : undefined,
				body: entry.body || undefined
			})
			if (entry.id !== undefined) await outboxDelete(entry.id)
			flushed += 1
		} catch {
			break
		}
	}
	if (flushed > 0) {
		const clientList = await self.clients.matchAll({ type: 'window' })
		for (const client of clientList) {
			client.postMessage({ type: 'outbox-flushed', count: flushed })
		}
	}
}

self.addEventListener('message', (event) => {
	const data = event.data as { type?: string } | null
	if (data?.type === 'replay-outbox') {
		event.waitUntil(replayOutbox())
	}
})

self.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url)

	if (event.request.method !== 'GET') {
		const queueable =
			QUEUEABLE_METHODS.includes(event.request.method) && url.pathname.startsWith('/api/')
		if (!queueable) return
		event.respondWith(
			(async () => {
				const body = await event.request.clone().text()
				try {
					return await fetch(event.request)
				} catch {
					await outboxAdd({
						url: event.request.url,
						method: event.request.method,
						contentType: event.request.headers.get('content-type') ?? 'application/json',
						body,
						ts: Date.now()
					})
					return new Response(
						JSON.stringify({ queued: true, message: '目前離線，變更已暫存，恢復連線後會自動同步' }),
						{ status: 503, headers: { 'content-type': 'application/json' } }
					)
				}
			})()
		)
		return
	}

	// SvelteKit client-side navigations fetch route data from `__data.json` instead of
	// issuing a document navigation. Cache those responses too, otherwise clicking a
	// trip while offline bypasses this handler and SvelteKit renders its 500 page.
	const isSvelteKitData =
		url.origin === self.location.origin && url.pathname.endsWith('/__data.json')
	const isStaticAsset =
		url.origin === self.location.origin &&
		['script', 'style', 'font', 'image'].includes(event.request.destination)
	const shouldCache =
		event.request.mode === 'navigate' ||
		url.pathname.startsWith('/api/trips/') ||
		isSvelteKitData ||
		isStaticAsset
	if (!shouldCache) return

	event.respondWith(
		(async () => {
			const cache = await caches.open(OFFLINE_CACHE)
			const matchCached = () =>
				cache.match(event.request).then(async (cached) => {
					if (cached) return cached
					if (isSvelteKitData) {
						return cache.match(event.request, { ignoreSearch: true })
					}
					if (event.request.mode === 'navigate') {
						return cache.match(event.request, { ignoreVary: true })
					}
					return undefined
				})
			try {
				const response = await fetch(event.request)
				if (response.ok) {
					await cache.put(event.request, response.clone())
					return response
				}

				// DevTools Offline and some development proxies resolve fetches with a
				// 5xx response instead of rejecting. Treat that as a network failure when
				// a previously successful response is available.
				return (await matchCached()) ?? response
			} catch {
				const cached = await matchCached()
				if (cached) return cached
				throw new Error('Offline response unavailable')
			}
		})()
	)
})

self.addEventListener('push', (event) => {
	let payload: { title?: string; body?: string; url?: string }
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
