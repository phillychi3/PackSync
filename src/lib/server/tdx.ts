import { env } from '$env/dynamic/private'

export const tdxConfigured = () => Boolean(env.TDX_CLIENT_ID && env.TDX_CLIENT_SECRET)

// 台灣本島＋離島概略範圍，落在此範圍內的路線優先使用 TDX
export function inTaiwan(lat: number, lng: number) {
	return lat >= 21.5 && lat <= 26.5 && lng >= 118 && lng <= 122.3
}

let cachedToken: { token: string; expiresAt: number } | null = null

async function getTdxToken(): Promise<string | null> {
	if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) return cachedToken.token
	try {
		const res = await fetch(
			'https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token',
			{
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({
					grant_type: 'client_credentials',
					client_id: env.TDX_CLIENT_ID!,
					client_secret: env.TDX_CLIENT_SECRET!
				})
			}
		)
		if (!res.ok) return null
		const body = (await res.json()) as { access_token: string; expires_in: number }
		cachedToken = {
			token: body.access_token,
			expiresAt: Date.now() + body.expires_in * 1000
		}
		return cachedToken.token
	} catch {
		return null
	}
}

// ─── HERE flexible polyline 解碼（TDX MaaS routing 的 polyline 編碼格式） ────
// https://github.com/heremaps/flexible-polyline
// 使用算術運算避免大數值在 32-bit 位元運算下溢位

const FLEX_TABLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function decodeFlexiblePolyline(encoded: string): [number, number][] | null {
	try {
		const pos = { i: 0 }
		const readUnsigned = () => {
			let result = 0
			let shift = 0
			for (;;) {
				const value = FLEX_TABLE.indexOf(encoded[pos.i++])
				if (value < 0) throw new Error('invalid character')
				result += (value & 0x1f) * Math.pow(2, shift)
				shift += 5
				if ((value & 0x20) === 0) return result
			}
		}
		const readSigned = () => {
			const value = readUnsigned()
			return value % 2 === 1 ? -(value + 1) / 2 : value / 2
		}

		const version = readUnsigned()
		if (version !== 1) return null
		const header = readUnsigned()
		const precision = header & 15
		const thirdDim = (header >> 4) & 7
		const factor = Math.pow(10, precision)

		const coords: [number, number][] = []
		let lat = 0
		let lng = 0
		while (pos.i < encoded.length) {
			lat += readSigned()
			lng += readSigned()
			if (thirdDim) readSigned()
			coords.push([lat / factor, lng / factor])
		}
		return coords.length >= 2 ? coords : null
	} catch {
		return null
	}
}

// ─── MaaS 路徑規劃 ───────────────────────────────────────────────────────────

type TdxPlace = {
	time?: string
	place?: { name?: string; location?: { lat?: number; lng?: number } }
}
type TdxSection = {
	type?: string
	polyline?: string
	departure?: TdxPlace
	arrival?: TdxPlace
	transport?: { mode?: string; name?: string }
}
type TdxRoute = { sections?: TdxSection[] }

export type TransitLeg = {
	mode: string
	name?: string
	fromName?: string
	toName?: string
	departureTime?: string
	arrivalTime?: string
	coords: [number, number][]
}

export type TransitRoute = {
	legs: TransitLeg[]
	durationMinutes: number | null
	departureTime: string | null
	arrivalTime: string | null
	transfers: number | null
	services: string[]
}

function sectionCoords(section: TdxSection): [number, number][] | null {
	if (section.polyline) {
		const decoded = decodeFlexiblePolyline(section.polyline)
		if (decoded) return decoded
	}
	const from = section.departure?.place?.location
	const to = section.arrival?.place?.location
	if (from?.lat != null && from?.lng != null && to?.lat != null && to?.lng != null) {
		return [
			[from.lat, from.lng],
			[to.lat, to.lng]
		]
	}
	return null
}

export async function tdxTransitRoute(
	from: [number, number],
	to: [number, number]
): Promise<TransitRoute | null> {
	const token = await getTdxToken()
	if (!token) return null
	try {
		const res = await fetch(
			`https://tdx.transportdata.tw/api/maas/routing?origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&gc=1.0&top=1&transit=3,4,5,6,7,8,9`,
			{
				headers: { authorization: `Bearer ${token}` },
				signal: AbortSignal.timeout(10000)
			}
		)
		if (!res.ok) return null
		const body = (await res.json()) as { data?: { routes?: TdxRoute[] } }
		const sections = body.data?.routes?.[0]?.sections
		if (!Array.isArray(sections) || sections.length === 0) return null

		const legs: TransitLeg[] = []
		for (const section of sections) {
			const coords = sectionCoords(section)
			if (!coords) continue
			legs.push({
				mode: section.type === 'pedestrian' ? 'WALK' : (section.transport?.mode ?? 'TRANSIT'),
				name: section.transport?.name,
				fromName: section.departure?.place?.name,
				toName: section.arrival?.place?.name,
				departureTime: section.departure?.time,
				arrivalTime: section.arrival?.time,
				coords
			})
		}
		if (legs.length === 0) return null
		const departureTime = legs.find((leg) => leg.departureTime)?.departureTime ?? null
		const arrivalTime = legs.findLast((leg) => leg.arrivalTime)?.arrivalTime ?? null
		const durationMs =
			departureTime && arrivalTime ? Date.parse(arrivalTime) - Date.parse(departureTime) : NaN
		const transitLegs = legs.filter((leg) => leg.mode !== 'WALK')
		return {
			legs,
			durationMinutes: Number.isFinite(durationMs)
				? Math.max(1, Math.round(durationMs / 60000))
				: null,
			departureTime,
			arrivalTime,
			transfers: transitLegs.length > 0 ? Math.max(0, transitLegs.length - 1) : null,
			services: [
				...new Set(
					transitLegs.map((leg) => leg.name).filter((name): name is string => Boolean(name))
				)
			]
		}
	} catch {
		return null
	}
}
