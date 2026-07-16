import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireAuth, requireMember } from '$lib/server/api'
import { inTaiwan, tdxConfigured, tdxTransitRoute } from '$lib/server/tdx'

type MotisLeg = {
	mode: string
	legGeometry?: { points: string; precision: number }
}

// 使用算術運算而非位元運算：precision 7 時經度的 zigzag 值會超過 32-bit，位元運算會溢位
function decodePolyline(encoded: string, precision: number): [number, number][] {
	const factor = Math.pow(10, precision)
	const coords: [number, number][] = []
	let index = 0
	let lat = 0
	let lng = 0
	while (index < encoded.length) {
		for (const axis of [0, 1]) {
			let result = 0
			let shift = 0
			let byte: number
			do {
				byte = encoded.charCodeAt(index++) - 63
				result += (byte & 0x1f) * Math.pow(2, shift)
				shift += 5
			} while (byte >= 0x20)
			const delta = result % 2 === 1 ? -(result + 1) / 2 : result / 2
			if (axis === 0) lat += delta
			else lng += delta
		}
		coords.push([lat / factor, lng / factor])
	}
	return coords
}

/**
 * Public-transit routing proxy.
 * - Taiwan coordinates: TDX MaaS routing (needs TDX_CLIENT_ID / TDX_CLIENT_SECRET in .env)
 * - Elsewhere: Transitous (community MOTIS instance, free, no key; coverage varies)
 * An empty legs array means the caller should fall back to a straight line.
 */
export const GET: RequestHandler = async ({ locals, params, url }) => {
	const user = requireAuth(locals)
	await requireMember(user.id, params.tripId)

	const fromLat = Number(url.searchParams.get('fromLat'))
	const fromLng = Number(url.searchParams.get('fromLng'))
	const toLat = Number(url.searchParams.get('toLat'))
	const toLng = Number(url.searchParams.get('toLng'))
	if ([fromLat, fromLng, toLat, toLng].some((value) => !Number.isFinite(value))) {
		throw error(400, 'fromLat/fromLng/toLat/toLng are required')
	}

	if (tdxConfigured() && inTaiwan(fromLat, fromLng) && inTaiwan(toLat, toLng)) {
		const legs = await tdxTransitRoute([fromLat, fromLng], [toLat, toLng])
		if (legs.length > 0) return json({ legs })
	}

	try {
		const upstream = await fetch(
			`https://api.transitous.org/api/v1/plan?fromPlace=${fromLat},${fromLng}&toPlace=${toLat},${toLng}`,
			{
				headers: {
					'User-Agent': 'PackSync/1.0 travel-planning-pwa (https://github.com/phillychi3)'
				},
				signal: AbortSignal.timeout(8000)
			}
		)
		if (!upstream.ok) return json({ legs: [] })
		const body = (await upstream.json()) as { itineraries?: { legs?: MotisLeg[] }[] }
		const itinerary = body.itineraries?.[0]
		if (!itinerary?.legs?.length) return json({ legs: [] })

		const legs = itinerary.legs
			.filter((leg) => leg.legGeometry?.points)
			.map((leg) => ({
				mode: leg.mode,
				coords: decodePolyline(leg.legGeometry!.points, leg.legGeometry!.precision ?? 7)
			}))
			.filter((leg) => leg.coords.length >= 2)

		return json({ legs })
	} catch {
		return json({ legs: [] })
	}
}
