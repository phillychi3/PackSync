import { json, error } from '@sveltejs/kit'
import type { RequestHandler } from './$types'
import { requireAuth, requireMember } from '$lib/server/api'
import { inTaiwan, tdxConfigured, tdxTransitRoute } from '$lib/server/tdx'

type MotisLeg = {
	mode: string
	startTime?: string | number
	endTime?: string | number
	duration?: number
	routeShortName?: string
	routeLongName?: string
	headsign?: string
	from?: { name?: string }
	to?: { name?: string }
	legGeometry?: { points: string; precision: number }
}

type MotisItinerary = {
	duration?: number
	startTime?: string | number
	endTime?: string | number
	transfers?: number
	legs?: MotisLeg[]
}

type TransitResponse = {
	legs: Array<{
		mode: string
		name?: string
		fromName?: string
		toName?: string
		departureTime?: string | null
		arrivalTime?: string | null
		coords: [number, number][]
	}>
	source: string | null
	durationMinutes: number | null
	departureTime: string | null
	arrivalTime: string | null
	transfers: number | null
	services: string[]
}

const SUCCESS_CACHE_MS = 5 * 60 * 1000
const EMPTY_CACHE_MS = 60 * 1000
const MAX_CACHE_ENTRIES = 250
const routeCache = new Map<string, { value: TransitResponse; expiresAt: number }>()

function coordinateKey(values: number[]) {
	return values.map((value) => value.toFixed(5)).join(':')
}

function cachedRoute(key: string) {
	const cached = routeCache.get(key)
	if (!cached) return null
	if (cached.expiresAt <= Date.now()) {
		routeCache.delete(key)
		return null
	}
	return cached.value
}

function cacheRoute(key: string, value: TransitResponse) {
	if (routeCache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = routeCache.keys().next().value
		if (oldestKey) routeCache.delete(oldestKey)
	}
	routeCache.set(key, {
		value,
		expiresAt: Date.now() + (value.legs.length > 0 ? SUCCESS_CACHE_MS : EMPTY_CACHE_MS)
	})
	return value
}

function emptyRoute(): TransitResponse {
	return {
		legs: [],
		source: null,
		durationMinutes: null,
		departureTime: null,
		arrivalTime: null,
		transfers: null,
		services: []
	}
}

function toIsoTime(value: string | number | undefined): string | null {
	if (value == null) return null
	const date = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value)
	return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function transitModeLabel(mode: string) {
	const labels: Record<string, string> = {
		BUS: '公車',
		TRAM: '路面電車',
		SUBWAY: '地鐵',
		METRO: '地鐵',
		RAIL: '鐵路',
		TRAIN: '鐵路',
		FERRY: '渡輪',
		GONDOLA: '纜車'
	}
	return labels[mode.toUpperCase()] ?? '大眾運輸'
}

function motisServiceName(leg: MotisLeg) {
	const longName = leg.routeLongName?.trim()
	const shortName = leg.routeShortName?.trim()
	if (longName && shortName && longName.toLocaleLowerCase() !== shortName.toLocaleLowerCase()) {
		return `${longName}（${shortName}）`
	}
	if (longName) return longName
	if (shortName) return `${transitModeLabel(leg.mode)} ${shortName}`
	if (leg.headsign?.trim()) return `${transitModeLabel(leg.mode)}（往 ${leg.headsign.trim()}）`
	return transitModeLabel(leg.mode)
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
	const cacheKey = coordinateKey([fromLat, fromLng, toLat, toLng])
	const cached = cachedRoute(cacheKey)
	if (cached) return json(cached, { headers: { 'x-route-cache': 'HIT' } })

	if (tdxConfigured() && inTaiwan(fromLat, fromLng) && inTaiwan(toLat, toLng)) {
		const route = await tdxTransitRoute([fromLat, fromLng], [toLat, toLng])
		if (route) {
			const value: TransitResponse = { ...route, source: 'TDX' }
			return json(cacheRoute(cacheKey, value), { headers: { 'x-route-cache': 'MISS' } })
		}
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
		if (!upstream.ok) return json(cacheRoute(cacheKey, emptyRoute()))
		const body = (await upstream.json()) as { itineraries?: MotisItinerary[] }
		const itinerary = body.itineraries?.[0]
		if (!itinerary?.legs?.length) return json(cacheRoute(cacheKey, emptyRoute()))

		const legs = itinerary.legs
			.filter((leg) => leg.legGeometry?.points)
			.map((leg) => ({
				mode: leg.mode,
				name: leg.mode.toUpperCase() === 'WALK' ? undefined : motisServiceName(leg),
				fromName: leg.from?.name,
				toName: leg.to?.name,
				departureTime: toIsoTime(leg.startTime),
				arrivalTime: toIsoTime(leg.endTime),
				coords: decodePolyline(leg.legGeometry!.points, leg.legGeometry!.precision ?? 7)
			}))
			.filter((leg) => leg.coords.length >= 2)

		const transitLegs = itinerary.legs.filter((leg) => leg.mode.toUpperCase() !== 'WALK')
		const value: TransitResponse = {
			legs,
			source: 'Transitous',
			durationMinutes:
				itinerary.duration != null ? Math.max(1, Math.round(itinerary.duration / 60)) : null,
			departureTime: toIsoTime(itinerary.startTime),
			arrivalTime: toIsoTime(itinerary.endTime),
			transfers:
				itinerary.transfers ??
				(transitLegs.length > 0 ? Math.max(0, transitLegs.length - 1) : null),
			services: [
				...new Set(
					transitLegs.map(motisServiceName).filter((name): name is string => Boolean(name))
				)
			]
		}
		return json(cacheRoute(cacheKey, value), { headers: { 'x-route-cache': 'MISS' } })
	} catch {
		return json(cacheRoute(cacheKey, emptyRoute()))
	}
}
