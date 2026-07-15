const OFFLINE_CACHE = 'packsync-offline-v1'

/** Network-first GET with a direct Cache Storage fallback. */
export async function offlineFetch(input: RequestInfo | URL): Promise<Response> {
	const request = new Request(input, { credentials: 'same-origin' })
	const cache = await caches.open(OFFLINE_CACHE)

	try {
		const response = await fetch(request)
		if (response.ok) {
			await cache.put(request, response.clone())
			return response
		}
		return (await cache.match(request)) ?? response
	} catch (error) {
		const cached = await cache.match(request)
		if (cached) return cached
		throw error
	}
}
