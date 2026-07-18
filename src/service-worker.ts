/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

declare const self: ServiceWorkerGlobalScope

const PRECACHE_PREFIX = 'packsync-precache-'
const PRECACHE = `${PRECACHE_PREFIX}${version}`
const PRECACHE_ASSETS = [...build, ...files]
const PRECACHE_URLS = new Set(
	PRECACHE_ASSETS.map((path) => new URL(path, self.location.origin).href)
)

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(PRECACHE)
			.then((cache) => cache.addAll(PRECACHE_ASSETS))
			.then(() => self.skipWaiting())
	)
})

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys
						.filter((key) => key.startsWith(PRECACHE_PREFIX) && key !== PRECACHE)
						.map((key) => caches.delete(key))
				)
			)
			.then(() => self.clients.claim())
	)
})

type OutboxEntry = {
	id?: number
	url: string
	method: string
	contentType: string
	body: string
	ts: number
	idempotencyKey?: string
}

const OUTBOX_DB = 'packsync-outbox'
const OUTBOX_STORE = 'requests'
const QUEUEABLE_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE']
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
			const headers: Record<string, string> = {}
			if (entry.body) headers['content-type'] = entry.contentType
			if (entry.idempotencyKey) headers['x-idempotency-key'] = entry.idempotencyKey
			await fetch(entry.url, {
				method: entry.method,
				headers: Object.keys(headers).length > 0 ? headers : undefined,
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
						ts: Date.now(),
						...(event.request.method === 'POST' && { idempotencyKey: crypto.randomUUID() })
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

	if (PRECACHE_URLS.has(url.href)) {
		event.respondWith(
			(async () => {
				const precache = await caches.open(PRECACHE)
				const cached = await precache.match(event.request)
				if (cached) return cached
				const response = await fetch(event.request)
				if (response.ok) event.waitUntil(precache.put(event.request, response.clone()))
				return response
			})()
		)
		return
	}

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
				caches.match(event.request).then(async (cached) => {
					if (cached) return cached
					if (isSvelteKitData) {
						return caches.match(event.request, { ignoreSearch: true })
					}
					if (event.request.mode === 'navigate') {
						return caches.match(event.request, { ignoreVary: true })
					}
					return undefined
				})
			try {
				const response = await fetch(event.request)
				if (response.ok) {
					event.waitUntil(cache.put(event.request, response.clone()))
					return response
				}

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
