import { json } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireAuth, requireMember } from '$lib/server/api'

type NominatimItem = {
	place_id: number
	display_name: string
	lat: string
	lon: string
	name?: string
}

export const GET: RequestHandler = async ({ locals, params, url, fetch }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const q = url.searchParams.get('q')?.trim()
	if (!q || q.length < 2) return json([])

	const upstream = await fetch(
		`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
		{
			headers: {
				'User-Agent': 'PackSync/1.0 travel-planning-app',
				'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8'
			}
		}
	)

	if (!upstream.ok) return json([])

	const results: NominatimItem[] = await upstream.json()

	return json(
		results.map((r) => ({
			placeId: r.place_id,
			name: r.name?.trim() || r.display_name.split(',')[0].trim(),
			displayName: r.display_name,
			lat: parseFloat(r.lat),
			lng: parseFloat(r.lon)
		}))
	)
}
