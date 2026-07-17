<script lang="ts">
	import type * as LType from 'leaflet'
	import 'leaflet/dist/leaflet.css'
	import markerIcon from 'leaflet/dist/images/marker-icon.png'
	import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
	import markerShadow from 'leaflet/dist/images/marker-shadow.png'
	import {
		CalendarDays,
		Car,
		Footprints,
		MapPin,
		Pencil,
		Plane,
		Plus,
		Search,
		ShieldAlert,
		Ship,
		TrainFront,
		Trash2,
		X
	} from '@lucide/svelte'
	import ActionMenu from '$lib/components/action-menu.svelte'
	import { Button } from '$lib/components/ui/button'
	import * as Drawer from '$lib/components/ui/drawer'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { confirmDialog } from '$lib/stores/confirm'
	import { toast } from '$lib/stores/toast'
	import { offlineFetch } from '$lib/offline-fetch'
	import { setCriticalItems, setItinerary, setTripContext } from '$lib/stores/trip'
	import { onMount } from 'svelte'
	import { MediaQuery } from 'svelte/reactivity'
	import type { PageData } from './$types'

	type Place = {
		id: string
		name: string
		address: string | null
		lat: number | null
		lng: number | null
		category: string | null
		openingHours: string | null
		rating: number | null
		ratingCount: number | null
	}
	type Item = {
		id: string
		date: string
		startTime: string | null
		endTime: string | null
		title: string
		notes: string | null
		placeId: string | null
		transportMode: string | null
		place: Place | null
	}

	const TRANSPORT_OPTIONS = [
		{ value: '', label: '不指定' },
		{ value: 'walk', label: '步行' },
		{ value: 'transit', label: '大眾運輸' },
		{ value: 'drive', label: '開車' },
		{ value: 'flight', label: '航班' },
		{ value: 'boat', label: '船' }
	]
	const TRANSPORT_LABELS: Record<string, string> = {
		walk: '步行',
		transit: '大眾運輸',
		drive: '開車',
		flight: '航班',
		boat: '船'
	}
	const MODE_ICONS: Record<string, typeof Car> = {
		walk: Footprints,
		transit: TrainFront,
		drive: Car,
		flight: Plane,
		boat: Ship
	}

	function modeIcon(mode: string) {
		return MODE_ICONS[mode] ?? Car
	}
	type Critical = {
		id: string
		name: string
		scheduleItemId: string | null
		confirmations: { userId: string }[]
	}
	type SearchResult = {
		placeId: number
		name: string
		displayName: string
		lat: number
		lng: number
	}

	let { data }: { data: PageData } = $props()
	const readonly = $derived(data.trip.status === 'completed')
	const tidy = $derived(data.trip.status === 'ongoing')
	let items = $state<Item[]>([])
	let places = $state<Place[]>([])
	let criticalItems = $state<Critical[]>([])
	let form = $state({
		date: '',
		startTime: '',
		endTime: '',
		title: '',
		notes: '',
		placeId: '',
		transportMode: ''
	})
	let editingId = $state<string | null>(null)
	let editForm = $state({
		date: '',
		startTime: '',
		endTime: '',
		title: '',
		notes: '',
		placeId: '',
		transportMode: ''
	})
	let saving = $state(false)
	let placeDetails = $state({ openingHours: '', rating: '', ratingCount: '' })

	// Place search state
	let newPlace = $state({
		show: false,
		forEdit: false,
		query: '',
		results: [] as SearchResult[],
		searching: false
	})
	let searchTimer: ReturnType<typeof setTimeout> | null = null

	// Map
	let mapEl: HTMLDivElement
	let mapInitialized = $state(false)
	let L: typeof LType | null = null
	let leafMap: LType.Map | null = null
	let mapMarkers: LType.Marker[] = []
	let mapRoutes: LType.Polyline[] = []
	let itemMarkers: Record<string, LType.Marker> = {}
	let markerVersion = $state(0)
	let markerEpoch = 0

	function numberIcon(n: number, active: boolean) {
		return L!.divIcon({
			className: '',
			html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border:2px solid ${active ? '#151817' : '#fff'};background:${active ? '#d8ff36' : '#151817'};color:${active ? '#151817' : '#fff'};font:700 12px/1 ui-monospace,SFMono-Regular,monospace;box-shadow:0 1px 3px rgba(0,0,0,.35)">${n || '·'}</div>`,
			iconSize: [26, 26],
			iconAnchor: [13, 13],
			popupAnchor: [0, -14]
		})
	}

	function placeDotIcon() {
		return L!.divIcon({
			className: '',
			html: '<div style="width:12px;height:12px;border:2px solid #fff;background:#9ca3af;border-radius:9999px;box-shadow:0 1px 2px rgba(0,0,0,.3)"></div>',
			iconSize: [12, 12],
			iconAnchor: [6, 6],
			popupAnchor: [0, -8]
		})
	}

	let selectedDate = $state<string>('all')
	let highlightedItemId = $state<string | null>(null)
	let viewMode = $state<'list' | 'timeline' | 'calendar'>('list')
	const phone = new MediaQuery('(max-width: 639px)')
	let drawerOpen = $state(false)

	let dayGroups = $derived.by(() => {
		const groups: Record<string, Item[]> = {}
		for (const item of sortItems(items)) {
			groups[item.date] = [...(groups[item.date] ?? []), item]
		}
		return Object.entries(groups).map(([date, dayItems]) => ({ date, items: dayItems }))
	})

	let dateTabs = $derived.by(() => {
		const dates: string[] = []
		if (data.trip.startDate) {
			const start = Date.parse(data.trip.startDate)
			const end = Date.parse(data.trip.endDate ?? data.trip.startDate)
			for (let t = start; t <= end; t += 86400000) {
				dates.push(new Date(t).toISOString().slice(0, 10))
			}
		}
		for (const item of items) {
			if (!dates.includes(item.date)) dates.push(item.date)
		}
		return dates.sort()
	})

	let visibleGroups = $derived(
		selectedDate === 'all' ? dayGroups : dayGroups.filter((group) => group.date === selectedDate)
	)

	let visibleItems = $derived(visibleGroups.flatMap((group) => group.items))
	let itemNumbers = $derived.by(() => {
		const numbers: Record<string, number> = {}
		visibleItems.forEach((item, index) => {
			numbers[item.id] = index + 1
		})
		return numbers
	})

	// Timeline view
	const HOUR_PX = 56
	const timelineDay = $derived(selectedDate === 'all' ? (dateTabs[0] ?? '') : selectedDate)
	const timelineItems = $derived(
		sortItems(items).filter((item) => item.date === timelineDay && item.startTime)
	)
	const allDayItems = $derived(
		sortItems(items).filter((item) => item.date === timelineDay && !item.startTime)
	)
	const hourRange = $derived.by(() => {
		let start = 8
		let end = 21
		for (const item of timelineItems) {
			const from = Number(item.startTime!.slice(0, 2))
			const to = item.endTime ? Number(item.endTime.slice(0, 2)) + 1 : from + 1
			if (from < start) start = from
			if (to > end) end = to
		}
		return { start, end: Math.min(end, 24) }
	})

	function toMinutes(time: string) {
		return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
	}

	function timelinePosition(item: Item) {
		const startMin = toMinutes(item.startTime!)
		const endMin = item.endTime ? toMinutes(item.endTime) : startMin + 60
		const top = ((startMin - hourRange.start * 60) / 60) * HOUR_PX
		const height = Math.max(((Math.max(endMin, startMin + 30) - startMin) / 60) * HOUR_PX, 36)
		return `top:${top}px;height:${height}px`
	}

	// Calendar view
	let calendarMonth = $state('')

	const itemsByDate = $derived.by(() => {
		const map: Record<string, Item[]> = {}
		for (const item of sortItems(items)) {
			map[item.date] = [...(map[item.date] ?? []), item]
		}
		return map
	})

	const calendarWeeks = $derived.by(() => {
		if (!calendarMonth) return []
		const firstTs = Date.parse(`${calendarMonth}-01`)
		if (Number.isNaN(firstTs)) return []
		const firstWeekday = new Date(firstTs).getUTCDay()
		const [year, month] = calendarMonth.split('-').map(Number)
		const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
		const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null)
		for (let day = 1; day <= daysInMonth; day++) {
			cells.push(`${calendarMonth}-${String(day).padStart(2, '0')}`)
		}
		while (cells.length % 7 !== 0) cells.push(null)
		const weeks: (string | null)[][] = []
		for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
		return weeks
	})

	function openCalendar() {
		if (!calendarMonth) {
			const base =
				selectedDate !== 'all'
					? selectedDate
					: (data.trip.startDate ?? new Date().toISOString().slice(0, 10))
			calendarMonth = base.slice(0, 7)
		}
		viewMode = 'calendar'
	}

	function shiftMonth(delta: number) {
		const [year, month] = calendarMonth.split('-').map(Number)
		const total = year * 12 + (month - 1) + delta
		const nextYear = Math.floor(total / 12)
		const nextMonth = (total % 12) + 1
		calendarMonth = `${nextYear}-${String(nextMonth).padStart(2, '0')}`
	}

	function pickCalendarDay(day: string) {
		selectedDate = day
		form.date = day
		viewMode = 'list'
	}

	function relatedCritical(item: Item) {
		return criticalItems.filter(
			(critical) => critical.scheduleItemId === null || critical.scheduleItemId === item.id
		)
	}

	$effect(() => {
		if (!mapInitialized) return
		const ps = places
		const day = selectedDate
		const itinerary = sortItems(items).filter((item) => day === 'all' || item.date === day)
		if (!L || !leafMap) return
		mapMarkers.forEach((m) => m.remove())
		mapMarkers = []
		mapRoutes.forEach((route) => route.remove())
		mapRoutes = []
		itemMarkers = {}
		const linkedPlaceIds: string[] = []
		for (const item of itinerary) {
			const p = item.place
			if (!p || p.lat === null || p.lng === null) continue
			linkedPlaceIds.push(p.id)
			const m = L.marker([p.lat, p.lng], { icon: numberIcon(itemNumbers[item.id] ?? 0, false) })
				.bindPopup(
					`<b>${item.title}</b><br><span style="font-size:12px;color:#666">${item.date}${item.startTime ? ' ' + item.startTime : ''} · ${p.name}</span>`
				)
				.addTo(leafMap)
			m.on('click', () => {
				highlightedItemId = item.id
				document
					.getElementById(`itinerary-item-${item.id}`)
					?.scrollIntoView({ behavior: 'smooth', block: 'center' })
			})
			mapMarkers.push(m)
			itemMarkers[item.id] = m
		}
		if (day === 'all') {
			const unlinked = ps.filter(
				(p) => p.lat !== null && p.lng !== null && !linkedPlaceIds.includes(p.id)
			)
			for (const p of unlinked) {
				const m = L.marker([p.lat!, p.lng!], { icon: placeDotIcon() })
					.bindPopup(
						`<b>${p.name}</b>${p.address ? '<br><span style="font-size:12px;color:#666">' + p.address + '</span>' : ''}`
					)
					.addTo(leafMap)
				mapMarkers.push(m)
			}
		}
		const withCoords = itinerary.filter(
			(item) => item.place?.lat != null && item.place?.lng != null
		)
		const segments: RouteSegment[] = []
		for (let i = 0; i < withCoords.length - 1; i++) {
			segments.push({
				from: [withCoords[i].place!.lat!, withCoords[i].place!.lng!],
				to: [withCoords[i + 1].place!.lat!, withCoords[i + 1].place!.lng!],
				fromTitle: withCoords[i].title,
				toTitle: withCoords[i + 1].title,
				mode: withCoords[i + 1].transportMode
			})
		}
		drawRoutes(segments)
		if (mapMarkers.length === 1) {
			leafMap.setView(mapMarkers[0].getLatLng(), 14)
		} else if (mapMarkers.length > 1) {
			const bounds = L.latLngBounds(mapMarkers.map((m) => m.getLatLng()))
			leafMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
		}
		markerVersion = ++markerEpoch
	})

	$effect(() => {
		void markerVersion
		const active = highlightedItemId
		if (!L) return
		for (const [itemId, marker] of Object.entries(itemMarkers)) {
			marker.setIcon(numberIcon(itemNumbers[itemId] ?? 0, itemId === active))
		}
	})

	// Real route geometry: OSRM (FOSSGIS) for walk/drive, Transitous (MOTIS) for transit;
	// falls back to a dashed straight line for flight/boat, uncovered regions, or on failure
	type RouteSegment = {
		from: [number, number]
		to: [number, number]
		fromTitle: string
		toTitle: string
		mode: string | null
	}
	type TransitLeg = {
		mode: string
		name?: string
		fromName?: string
		toName?: string
		departureTime?: string | null
		arrivalTime?: string | null
		coords: [number, number][]
	}
	type TransitRoute = {
		legs: TransitLeg[]
		source: string | null
		durationMinutes: number | null
		departureTime: string | null
		arrivalTime: string | null
		transfers: number | null
		services: string[]
		fares: { amount: number; currency: string; products: string[] }[]
	}
	type RoadRoute = {
		coords: [number, number][]
		durationMinutes: number
		distanceKm: number
	}
	type SegmentOptions = {
		loading: boolean
		loaded: boolean
		walk: RoadRoute | null
		drive: RoadRoute | null
		transit: TransitRoute | null
		error: string | null
	}
	const ROAD_CACHE_MS = 7 * 24 * 60 * 60 * 1000
	const TRANSIT_CACHE_MS = 5 * 60 * 1000
	const EMPTY_CACHE_MS = 60 * 1000
	const CACHE_PREFIX = 'packsync:route:v3:'
	const MAX_STORED_ROUTES = 40
	const routeCache: Record<string, RoadRoute> = {}
	const routeMissCache: Record<string, number> = {}
	const transitCache: Record<string, { value: TransitRoute; expiresAt: number }> = {}
	let segmentOptions = $state<Record<string, SegmentOptions>>({})
	let routeGeneration = 0

	function coordinateKey(from: [number, number], to: [number, number]) {
		return [...from, ...to].map((value) => value.toFixed(5)).join(':')
	}

	function readStoredRoute<T>(key: string): T | undefined {
		if (typeof localStorage === 'undefined') return undefined
		try {
			const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`)
			if (!raw) return undefined
			const cached = JSON.parse(raw) as { value: T; expiresAt: number }
			if (cached.expiresAt <= Date.now()) {
				localStorage.removeItem(`${CACHE_PREFIX}${key}`)
				return undefined
			}
			return cached.value
		} catch {
			return undefined
		}
	}

	function storeRoute<T>(key: string, value: T, ttl: number) {
		if (typeof localStorage === 'undefined') return
		try {
			const stored: { key: string; expiresAt: number }[] = []
			for (let index = localStorage.length - 1; index >= 0; index--) {
				const storedKey = localStorage.key(index)
				if (!storedKey?.startsWith(CACHE_PREFIX)) continue
				try {
					const entry = JSON.parse(localStorage.getItem(storedKey) ?? '') as { expiresAt: number }
					if (entry.expiresAt <= Date.now()) localStorage.removeItem(storedKey)
					else stored.push({ key: storedKey, expiresAt: entry.expiresAt })
				} catch {
					localStorage.removeItem(storedKey)
				}
			}
			if (stored.length >= MAX_STORED_ROUTES) {
				stored
					.sort((a, b) => a.expiresAt - b.expiresAt)
					.slice(0, stored.length - MAX_STORED_ROUTES + 1)
					.forEach((entry) => localStorage.removeItem(entry.key))
			}
			localStorage.setItem(
				`${CACHE_PREFIX}${key}`,
				JSON.stringify({ value, expiresAt: Date.now() + ttl })
			)
		} catch {
			// Storage may be full or disabled; the in-memory cache still works.
		}
	}

	function routeProfile(mode: string | null): 'car' | 'foot' | null {
		if (mode === 'walk') return 'foot'
		if (mode === 'drive' || mode === null) return 'car'
		return null
	}

	async function fetchTransitRoute(
		from: [number, number],
		to: [number, number]
	): Promise<TransitRoute> {
		const key = `transit:${coordinateKey(from, to)}`
		const memory = transitCache[key]
		if (memory?.expiresAt && memory.expiresAt > Date.now()) return memory.value
		const stored = readStoredRoute<TransitRoute>(key)
		if (stored) {
			transitCache[key] = { value: stored, expiresAt: Date.now() + TRANSIT_CACHE_MS }
			return stored
		}
		try {
			const res = await fetch(
				`/api/trips/${data.trip.id}/transit-route?fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
			)
			if (!res.ok) throw new Error('Transit route request failed')
			const body = (await res.json()) as TransitRoute
			const route = {
				legs: body.legs ?? [],
				source: body.source ?? null,
				durationMinutes: body.durationMinutes ?? null,
				departureTime: body.departureTime ?? null,
				arrivalTime: body.arrivalTime ?? null,
				transfers: body.transfers ?? null,
				services: body.services ?? [],
				fares: body.fares ?? []
			}
			const ttl = route.legs.length > 0 ? TRANSIT_CACHE_MS : EMPTY_CACHE_MS
			transitCache[key] = { value: route, expiresAt: Date.now() + ttl }
			storeRoute(key, route, ttl)
			return route
		} catch {
			const route = {
				legs: [],
				source: null,
				durationMinutes: null,
				departureTime: null,
				arrivalTime: null,
				transfers: null,
				services: [],
				fares: []
			}
			transitCache[key] = { value: route, expiresAt: Date.now() + EMPTY_CACHE_MS }
			storeRoute(key, route, EMPTY_CACHE_MS)
			return route
		}
	}

	async function fetchRoute(
		from: [number, number],
		to: [number, number],
		profile: 'car' | 'foot'
	): Promise<RoadRoute | null> {
		// Long segments (flights, ferries) don't have road routes
		if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) > 3) return null
		const key = `${profile}:${coordinateKey(from, to)}`
		if (routeCache[key]) return routeCache[key]
		if ((routeMissCache[key] ?? 0) > Date.now()) return null
		const stored = readStoredRoute<RoadRoute | null>(key)
		if (stored === null) {
			routeMissCache[key] = Date.now() + EMPTY_CACHE_MS
			return null
		}
		if (stored) {
			routeCache[key] = stored
			return stored
		}
		try {
			const res = await fetch(
				`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
			)
			if (!res.ok) {
				routeMissCache[key] = Date.now() + EMPTY_CACHE_MS
				storeRoute(key, null, EMPTY_CACHE_MS)
				return null
			}
			const body = await res.json()
			const result = body.routes?.[0]
			const coords: [number, number][] | undefined = result?.geometry?.coordinates
			if (!coords || coords.length < 2) {
				routeMissCache[key] = Date.now() + EMPTY_CACHE_MS
				storeRoute(key, null, EMPTY_CACHE_MS)
				return null
			}
			const route = {
				coords: coords.map(([lng, lat]) => [lat, lng] as [number, number]),
				durationMinutes: Math.max(1, Math.round(Number(result.duration) / 60)),
				distanceKm: Math.round((Number(result.distance) / 1000) * 10) / 10
			}
			routeCache[key] = route
			storeRoute(key, route, ROAD_CACHE_MS)
			return route
		} catch {
			routeMissCache[key] = Date.now() + EMPTY_CACHE_MS
			storeRoute(key, null, EMPTY_CACHE_MS)
			return null
		}
	}

	async function drawRoutes(segments: RouteSegment[]) {
		const generation = ++routeGeneration
		if (!L || !leafMap || segments.length === 0) return
		for (const segment of segments) {
			if (segment.mode === 'transit') {
				const transit = await fetchTransitRoute(segment.from, segment.to)
				if (generation !== routeGeneration || !L || !leafMap) return
				if (transit.legs.length > 0) {
					for (const leg of transit.legs) {
						const style =
							leg.mode === 'WALK'
								? { color: '#ea580c', weight: 3, opacity: 0.9, dashArray: '2 7' }
								: { color: '#7c3aed', weight: 5, opacity: 0.88 }
						const detail = leg.name ? ` · ${leg.name}` : ''
						const line = L.polyline(leg.coords, style)
							.bindPopup(`<b>${segment.fromTitle} → ${segment.toTitle}</b><br>大眾運輸${detail}`)
							.addTo(leafMap)
						mapRoutes.push(line)
					}
					continue
				}
			}
			const profile = routeProfile(segment.mode)
			const geometry = profile ? await fetchRoute(segment.from, segment.to, profile) : null
			if (generation !== routeGeneration || !L || !leafMap) return
			const style = geometry
				? profile === 'foot'
					? { color: '#ea580c', weight: 3, opacity: 0.9, dashArray: '2 7' }
					: { color: '#2563eb', weight: 5, opacity: 0.85 }
				: segment.mode === 'flight'
					? { color: '#0891b2', weight: 4, opacity: 0.8, dashArray: '12 8' }
					: segment.mode === 'boat'
						? { color: '#0f766e', weight: 4, opacity: 0.8, dashArray: '12 8' }
						: { color: '#6b7280', weight: 4, opacity: 0.75, dashArray: '8 8' }
			const label = geometry
				? profile === 'foot'
					? '步行'
					: '開車'
				: segment.mode === 'flight'
					? '航班（示意直線）'
					: segment.mode === 'boat'
						? '船（示意直線）'
						: '無法取得路線（示意直線）'
			const line = L.polyline(geometry?.coords ?? [segment.from, segment.to], style)
				.bindPopup(`<b>${segment.fromTitle} → ${segment.toTitle}</b><br>${label}`)
				.addTo(leafMap)
			mapRoutes.push(line)
		}
	}

	function itemCoords(item: Item): [number, number] | null {
		return item.place?.lat != null && item.place.lng != null
			? [item.place.lat, item.place.lng]
			: null
	}

	function segmentKey(from: Item, to: Item) {
		return `${from.id}:${to.id}`
	}

	async function loadSegmentOptions(fromItem: Item, toItem: Item) {
		const key = segmentKey(fromItem, toItem)
		const from = itemCoords(fromItem)
		const to = itemCoords(toItem)
		if (!from || !to) {
			segmentOptions[key] = {
				loading: false,
				loaded: true,
				walk: null,
				drive: null,
				transit: null,
				error: '起點或終點缺少座標，無法查詢交通方案。'
			}
			return
		}
		segmentOptions[key] = {
			loading: true,
			loaded: false,
			walk: null,
			drive: null,
			transit: null,
			error: null
		}
		const [walk, drive, transit] = await Promise.all([
			fetchRoute(from, to, 'foot'),
			fetchRoute(from, to, 'car'),
			fetchTransitRoute(from, to)
		])
		segmentOptions[key] = {
			loading: false,
			loaded: true,
			walk,
			drive,
			transit: transit.legs.length > 0 ? transit : null,
			error: !walk && !drive && transit.legs.length === 0 ? '目前查不到可用的交通方案。' : null
		}
	}

	// Compact auto-loaded duration shown between consecutive stops in the panel
	type SegmentSummary = { loading: boolean; minutes: number | null }
	let segmentSummary = $state<Record<string, SegmentSummary>>({})
	const summaryRequested: Record<string, true> = {}
	let expandedSegment = $state<string | null>(null)

	function summaryKey(fromItem: Item, toItem: Item) {
		const from = itemCoords(fromItem)
		const to = itemCoords(toItem)
		const coords = from && to ? coordinateKey(from, to) : 'na'
		return `${fromItem.id}:${toItem.id}:${toItem.transportMode ?? 'drive'}:${coords}`
	}

	async function loadSegmentSummary(fromItem: Item, toItem: Item) {
		const key = summaryKey(fromItem, toItem)
		if (summaryRequested[key]) return
		summaryRequested[key] = true
		const mode = toItem.transportMode ?? 'drive'
		const from = itemCoords(fromItem)
		const to = itemCoords(toItem)
		if (!from || !to || mode === 'flight' || mode === 'boat') {
			segmentSummary[key] = { loading: false, minutes: null }
			return
		}
		segmentSummary[key] = { loading: true, minutes: null }
		let minutes: number | null
		if (mode === 'transit') {
			const transit = await fetchTransitRoute(from, to)
			minutes = transit.legs.length > 0 ? transit.durationMinutes : null
		} else {
			const route = await fetchRoute(from, to, mode === 'walk' ? 'foot' : 'car')
			minutes = route?.durationMinutes ?? null
		}
		segmentSummary[key] = { loading: false, minutes }
	}

	$effect(() => {
		for (const group of visibleGroups) {
			for (let i = 1; i < group.items.length; i++) {
				loadSegmentSummary(group.items[i - 1], group.items[i])
			}
		}
	})

	function toggleSegment(fromItem: Item, toItem: Item) {
		const key = segmentKey(fromItem, toItem)
		if (expandedSegment === key) {
			expandedSegment = null
			return
		}
		expandedSegment = key
		const state = segmentOptions[key]
		if (!state?.loaded && !state?.loading) loadSegmentOptions(fromItem, toItem)
	}

	function formatClock(value: string | null) {
		if (!value) return ''
		const date = new Date(value)
		return Number.isNaN(date.getTime())
			? ''
			: new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit' }).format(date)
	}

	function formatFare(fare: { amount: number; currency: string }) {
		try {
			return new Intl.NumberFormat('zh-TW', {
				style: 'currency',
				currency: fare.currency
			}).format(fare.amount)
		} catch {
			return `${fare.currency} ${fare.amount}`
		}
	}

	function focusItemOnMap(item: Item) {
		const marker = itemMarkers[item.id]
		if (!marker || !leafMap) return
		highlightedItemId = item.id
		if (phone.current) drawerOpen = false
		mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		leafMap.setView(marker.getLatLng(), 16)
		marker.openPopup()
	}

	$effect(() => {
		if (!form.date && data.trip.startDate) form.date = data.trip.startDate
	})

	// Insertion suggestion: where in the day the new place fits with the least detour
	type InsertSlot = {
		index: number
		prev: Item | null
		next: Item | null
		detourKm: number | null
		suggestedTime: string
		best: boolean
	}

	function distanceKm(a: [number, number], b: [number, number]) {
		const rad = Math.PI / 180
		const dLat = (b[0] - a[0]) * rad
		const dLng = (b[1] - a[1]) * rad
		const h =
			Math.sin(dLat / 2) ** 2 +
			Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2
		return 6371 * 2 * Math.asin(Math.sqrt(h))
	}

	function minutesToTime(total: number) {
		const clamped = Math.min(Math.max(total, 0), 23 * 60 + 55)
		const rounded = Math.round(clamped / 5) * 5
		return `${String(Math.floor(rounded / 60)).padStart(2, '0')}:${String(rounded % 60).padStart(2, '0')}`
	}

	function suggestTime(prev: Item | null, next: Item | null) {
		const prevEnd = prev ? (prev.endTime ?? prev.startTime) : null
		const nextStart = next?.startTime ?? null
		if (prevEnd && nextStart)
			return minutesToTime(Math.floor((toMinutes(prevEnd) + toMinutes(nextStart)) / 2))
		if (prevEnd) return minutesToTime(toMinutes(prevEnd) + 90)
		if (nextStart) return minutesToTime(toMinutes(nextStart) - 90)
		return ''
	}

	const formPlace = $derived(places.find((p) => p.id === form.placeId) ?? null)
	const insertSlots = $derived.by(() => {
		if (!formPlace || formPlace.lat === null || formPlace.lng === null) return [] as InsertSlot[]
		const dayItems = itemsByDate[form.date] ?? []
		if (dayItems.length === 0) return [] as InsertSlot[]
		const target: [number, number] = [formPlace.lat, formPlace.lng]
		let bestIndex = -1
		let bestDetour = Infinity
		const slots: InsertSlot[] = []
		for (let i = 0; i <= dayItems.length; i++) {
			const prev = i > 0 ? dayItems[i - 1] : null
			const next = i < dayItems.length ? dayItems[i] : null
			const prevCoords = prev ? itemCoords(prev) : null
			const nextCoords = next ? itemCoords(next) : null
			let detourKm: number | null = null
			if (prevCoords && nextCoords) {
				detourKm =
					distanceKm(prevCoords, target) +
					distanceKm(target, nextCoords) -
					distanceKm(prevCoords, nextCoords)
			} else if (prevCoords) {
				detourKm = distanceKm(prevCoords, target)
			} else if (nextCoords) {
				detourKm = distanceKm(target, nextCoords)
			}
			if (detourKm !== null && detourKm < bestDetour) {
				bestDetour = detourKm
				bestIndex = i
			}
			slots.push({
				index: i,
				prev,
				next,
				detourKm,
				suggestedTime: suggestTime(prev, next),
				best: false
			})
		}
		return slots.map((slot) => ({ ...slot, best: slot.index === bestIndex }))
	})

	let insertChoice = $state<number | null>(null)
	let lastSlotContext = ''
	$effect(() => {
		const context = `${form.placeId}:${form.date}`
		if (context !== lastSlotContext) {
			lastSlotContext = context
			insertChoice = null
		}
	})

	function pickSlot(slot: InsertSlot) {
		insertChoice = slot.index
		if (slot.suggestedTime) form.startTime = slot.suggestedTime
	}

	function sortItems(arr: Item[]): Item[] {
		return arr.slice().sort((a, b) => {
			const d = a.date.localeCompare(b.date)
			if (d !== 0) return d
			const ta = a.startTime ?? ''
			const tb = b.startTime ?? ''
			if (!ta && !tb) return 0
			if (!ta) return -1
			if (!tb) return 1
			return ta.localeCompare(tb)
		})
	}

	async function load() {
		setTripContext(data.trip.id)
		const [itemsRes, placesRes, criticalRes] = await Promise.all([
			offlineFetch(`/api/trips/${data.trip.id}/itinerary`),
			offlineFetch(`/api/trips/${data.trip.id}/places`),
			offlineFetch(`/api/trips/${data.trip.id}/critical`)
		])
		if (itemsRes.ok) {
			items = await itemsRes.json()
			setItinerary(items)
		}
		if (placesRes.ok) places = await placesRes.json()
		if (criticalRes.ok) {
			criticalItems = await criticalRes.json()
			setCriticalItems(criticalItems)
		}
	}

	function onSearchInput() {
		if (searchTimer) clearTimeout(searchTimer)
		newPlace.results = []
		if (!newPlace.query.trim()) return
		searchTimer = setTimeout(searchPlaces, 500)
	}

	async function searchPlaces() {
		const q = newPlace.query.trim()
		if (q.length < 2) return
		newPlace.searching = true
		const res = await fetch(`/api/trips/${data.trip.id}/places/search?q=${encodeURIComponent(q)}`)
		if (res.ok) newPlace.results = await res.json()
		else newPlace.results = []
		newPlace.searching = false
	}

	async function selectSearchResult(result: SearchResult) {
		const res = await fetch(`/api/trips/${data.trip.id}/places`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: result.name,
				address: result.displayName,
				lat: result.lat,
				lng: result.lng,
				...placeDetails
			})
		})
		if (res.ok) {
			const p: Place = await res.json()
			places = [...places, p]
			if (newPlace.forEdit) editForm.placeId = p.id
			else form.placeId = p.id
			newPlace = { show: false, forEdit: false, query: '', results: [], searching: false }
			placeDetails = { openingHours: '', rating: '', ratingCount: '' }
		}
	}

	async function createManualPlace() {
		const name = newPlace.query.trim()
		if (!name) return
		const res = await fetch(`/api/trips/${data.trip.id}/places`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, ...placeDetails })
		})
		if (res.ok) {
			const p: Place = await res.json()
			places = [...places, p]
			if (newPlace.forEdit) editForm.placeId = p.id
			else form.placeId = p.id
			newPlace = { show: false, forEdit: false, query: '', results: [], searching: false }
			placeDetails = { openingHours: '', rating: '', ratingCount: '' }
		}
	}

	async function add(event: SubmitEvent) {
		event.preventDefault()
		if (!form.date || !form.title.trim()) return
		saving = true
		const response = await fetch(`/api/trips/${data.trip.id}/itinerary`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				...form,
				placeId: form.placeId || null,
				transportMode: form.transportMode || null
			})
		})
		if (response.ok) {
			items = sortItems([...items, await response.json()])
			form = { ...form, title: '', notes: '', placeId: '', transportMode: '' }
			toast.success('已加入行程')
		} else {
			toast.error('新增行程失敗，請稍後再試')
		}
		saving = false
	}

	function startEdit(item: Item) {
		editingId = item.id
		newPlace = { show: false, forEdit: false, query: '', results: [], searching: false }
		editForm = {
			date: item.date,
			startTime: item.startTime ?? '',
			endTime: item.endTime ?? '',
			title: item.title,
			notes: item.notes ?? '',
			placeId: item.placeId ?? '',
			transportMode: item.transportMode ?? ''
		}
	}

	async function saveEdit(id: string) {
		saving = true
		const res = await fetch(`/api/trips/${data.trip.id}/itinerary/${id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				...editForm,
				placeId: editForm.placeId || null,
				transportMode: editForm.transportMode || null
			})
		})
		if (res.ok) {
			const updated = await res.json()
			items = sortItems(items.map((item) => (item.id === id ? updated : item)))
			editingId = null
			toast.success('已更新行程')
		} else {
			toast.error('更新行程失敗，請稍後再試')
		}
		saving = false
	}

	async function remove(id: string) {
		const target = items.find((item) => item.id === id)
		if (!target) return
		const ok = await confirmDialog({
			title: '刪除行程',
			message: `確定要刪除「${target.title}」嗎？`,
			confirmLabel: '刪除',
			danger: true
		})
		if (!ok) return
		const res = await fetch(`/api/trips/${data.trip.id}/itinerary/${id}`, { method: 'DELETE' })
		if (!res.ok) {
			toast.error('刪除失敗，請稍後再試')
			return
		}
		items = items.filter((item) => item.id !== id)
		toast.success('已刪除行程', {
			action: {
				label: '復原',
				onClick: async () => {
					const restore = await fetch(`/api/trips/${data.trip.id}/itinerary`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							date: target.date,
							startTime: target.startTime ?? '',
							endTime: target.endTime ?? '',
							title: target.title,
							notes: target.notes ?? '',
							placeId: target.placeId,
							transportMode: target.transportMode
						})
					})
					if (restore.ok) {
						items = sortItems([...items, await restore.json()])
						toast.success('已復原行程')
					} else {
						toast.error('復原失敗')
					}
				}
			}
		})
	}

	function openNewPlace(forEdit: boolean) {
		newPlace = { show: true, forEdit, query: '', results: [], searching: false }
		placeDetails = { openingHours: '', rating: '', ratingCount: '' }
	}

	onMount(() => {
		;(async () => {
			await load()
			const mod = await import('leaflet')
			L = mod as unknown as typeof LType

			// Fix bundler icon paths（改用本地打包資源，離線也可用）
			const icons = L.Icon.Default as unknown as { prototype: Record<string, unknown> }
			delete icons.prototype['_getIconUrl']
			L.Icon.Default.mergeOptions({
				iconUrl: markerIcon,
				iconRetinaUrl: markerIcon2x,
				shadowUrl: markerShadow
			})

			leafMap = L.map(mapEl, { scrollWheelZoom: false }).setView([25.0375, 121.5625], 5)
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
			}).addTo(leafMap)

			mapInitialized = true
		})()

		const resizeObserver = new ResizeObserver(() => leafMap?.invalidateSize())
		resizeObserver.observe(mapEl)

		return () => {
			resizeObserver.disconnect()
			leafMap?.remove()
		}
	})
</script>

<main class="mx-auto w-full max-w-7xl max-sm:px-0 max-sm:py-0 sm:px-8 sm:py-8 lg:py-12">
	<!-- Header -->
	<div class="border-b border-black/15 pb-6 max-sm:hidden">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">01 / 行程</p>
		<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">每日安排</h2>
	</div>

	<!-- Map + Panel -->
	<div
		class="grid gap-6 max-sm:mt-0 max-sm:gap-0 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start"
	>
		<!-- Map column -->
		<div class="lg:sticky lg:top-6">
			<div
				class="relative w-full border border-black/10 max-sm:h-[calc(100dvh-9rem)] max-sm:border-x-0 sm:h-96 lg:h-[calc(100vh-8rem)]"
			>
				<div bind:this={mapEl} class="absolute inset-0"></div>
				{#if !mapInitialized}
					<div class="absolute inset-0 z-[600] grid place-items-center bg-[#eef0eb]">
						<span class="font-mono text-xs text-black/40">地圖載入中…</span>
					</div>
				{/if}
				<div
					class="absolute bottom-3 left-3 z-[500] grid grid-cols-2 gap-x-3 gap-y-1 border border-black/15 bg-white/95 px-3 py-2 text-[10px] shadow-sm backdrop-blur"
					aria-label="地圖路線圖例"
				>
					<span class="flex items-center gap-1.5"
						><i class="w-5 border-t-2 border-dotted border-orange-600"></i>步行</span
					>
					<span class="flex items-center gap-1.5"
						><i class="w-5 border-t-2 border-blue-600"></i>開車</span
					>
					<span class="flex items-center gap-1.5"
						><i class="w-5 border-t-2 border-violet-600"></i>大眾運輸</span
					>
					<span class="flex items-center gap-1.5"
						><i class="w-5 border-t-2 border-dashed border-cyan-700"></i>航班／船</span
					>
					<span class="col-span-2 flex items-center gap-1.5 text-black/50"
						><i class="w-5 border-t-2 border-dashed border-gray-500"></i>無路線資料</span
					>
				</div>
				{#if phone.current}
					<button
						type="button"
						class="absolute bottom-3 right-3 z-[500] flex items-center gap-2 bg-[#151817] px-4 py-2.5 text-sm font-bold text-white shadow-lg"
						onclick={() => (drawerOpen = true)}
					>
						<CalendarDays class="size-4 text-[#d8ff36]" />
						行程列表
						<span class="font-mono text-xs text-[#d8ff36]">{visibleItems.length}</span>
					</button>
				{/if}
			</div>
			<p class="mt-1.5 text-xs text-black/45 max-sm:hidden">
				地圖編號對應行程順序；點擊編號或路線可查看細節。
			</p>
		</div>

		<!-- Panel: desktop/tablet column, drawer on phones -->
		{#if !phone.current}
			<div class="min-w-0">
				{@render panelContent()}
			</div>
		{/if}
	</div>
</main>

{#if phone.current}
	<Drawer.Root bind:open={drawerOpen}>
		<Drawer.Content class="z-[1100] rounded-none border-t border-black/15 bg-white">
			<Drawer.Header class="border-b border-black/10 py-3 text-left">
				<Drawer.Title class="font-mono text-xs font-bold tracking-[0.18em] text-black/45"
					>01 / 行程</Drawer.Title
				>
				<p class="text-lg font-black tracking-[-0.03em]">每日安排</p>
			</Drawer.Header>
			<div class="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4">
				{@render panelContent()}
			</div>
		</Drawer.Content>
	</Drawer.Root>
{/if}

{#snippet panelContent()}
	<div class="min-w-0">
		<!-- View toggle -->
		<div class="flex gap-1">
			{#each [{ value: 'list', label: '清單' }, { value: 'timeline', label: '時間表' }, { value: 'calendar', label: '月曆' }] as mode (mode.value)}
				<button
					type="button"
					class="border px-3 py-1.5 font-mono text-xs font-bold transition {viewMode === mode.value
						? 'border-black bg-[#151817] text-white'
						: 'border-black/15 bg-white text-black/55 hover:border-black/40'}"
					onclick={() =>
						mode.value === 'calendar'
							? openCalendar()
							: (viewMode = mode.value as 'list' | 'timeline')}
				>
					{mode.label}
				</button>
			{/each}
		</div>

		<!-- Date tabs -->
		{#if dateTabs.length > 0}
			<div class="mt-3 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label="切換日期">
				<button
					type="button"
					role="tab"
					aria-selected={selectedDate === 'all'}
					class="shrink-0 border px-3 py-1.5 font-mono text-xs font-bold transition {selectedDate ===
					'all'
						? 'border-black bg-[#d8ff36]'
						: 'border-black/15 bg-white text-black/55 hover:border-black/40'}"
					onclick={() => (selectedDate = 'all')}
				>
					全部
				</button>
				{#each dateTabs as date, i (date)}
					<button
						type="button"
						role="tab"
						aria-selected={selectedDate === date}
						class="shrink-0 border px-3 py-1.5 font-mono text-xs font-bold transition {selectedDate ===
						date
							? 'border-black bg-[#d8ff36]'
							: 'border-black/15 bg-white text-black/55 hover:border-black/40'}"
						onclick={() => {
							selectedDate = date
							form.date = date
						}}
					>
						D{i + 1} · {date.slice(5)}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Items list -->
		<section class="mt-4">
			{#if viewMode === 'timeline'}
				<div class="border border-black/10 bg-white">
					<div class="flex items-center justify-between border-b border-black/10 px-4 py-3">
						<p class="font-mono text-xs font-bold text-[#779a00]">
							{timelineDay || '尚無日期'} · 時間表
						</p>
						<p class="text-xs text-black/40">
							{timelineItems.length + allDayItems.length} 個行程
						</p>
					</div>
					{#if allDayItems.length > 0}
						<div class="border-b border-black/10 px-4 py-2">
							<p class="mb-1.5 font-mono text-[10px] font-bold text-black/40">全天</p>
							<div class="flex flex-wrap gap-1.5">
								{#each allDayItems as item (item.id)}
									<span class="border border-black/15 bg-[#fbfcf8] px-2 py-1 text-xs font-bold">
										{item.title}
									</span>
								{/each}
							</div>
						</div>
					{/if}
					<div
						class="relative overflow-hidden"
						style={`height:${(hourRange.end - hourRange.start) * HOUR_PX}px`}
					>
						{#each Array.from({ length: hourRange.end - hourRange.start }, (_, i) => hourRange.start + i) as hour (hour)}
							<div
								class="absolute inset-x-0 border-t border-black/5"
								style={`top:${(hour - hourRange.start) * HOUR_PX}px`}
							>
								<span class="ml-2 font-mono text-[10px] text-black/35"
									>{String(hour).padStart(2, '0')}:00</span
								>
							</div>
						{/each}
						{#each timelineItems as item (item.id)}
							<button
								type="button"
								class="absolute left-14 right-3 overflow-hidden border-l-4 border-[#779a00] bg-[#f4f8e8] px-3 py-1.5 text-left transition hover:bg-[#ecf5d5] {highlightedItemId ===
								item.id
									? 'ring-1 ring-[#779a00]'
									: ''}"
								style={timelinePosition(item)}
								onclick={() => {
									highlightedItemId = item.id
									if (item.place?.lat != null && item.place?.lng != null) focusItemOnMap(item)
								}}
							>
								<p class="truncate text-sm font-bold">{item.title}</p>
								<p class="truncate font-mono text-[10px] text-black/45">
									{item.startTime}{item.endTime ? `–${item.endTime}` : ''}{item.place
										? ` · ${item.place.name}`
										: ''}
								</p>
							</button>
						{/each}
						{#if timelineItems.length === 0}
							<div class="absolute inset-0 grid place-items-center text-sm text-black/40">
								這一天沒有指定時間的行程。
							</div>
						{/if}
					</div>
				</div>
			{:else if viewMode === 'calendar'}
				<div class="border border-black/10 bg-white">
					<div class="flex items-center justify-between border-b border-black/10 px-4 py-3">
						<button
							type="button"
							class="grid size-8 place-items-center border border-black/15 hover:border-black"
							aria-label="上一個月"
							onclick={() => shiftMonth(-1)}
						>
							‹
						</button>
						<p class="font-mono text-sm font-black">{calendarMonth}</p>
						<button
							type="button"
							class="grid size-8 place-items-center border border-black/15 hover:border-black"
							aria-label="下一個月"
							onclick={() => shiftMonth(1)}
						>
							›
						</button>
					</div>
					<div class="grid grid-cols-7 border-b border-black/10">
						{#each ['日', '一', '二', '三', '四', '五', '六'] as weekday (weekday)}
							<p class="py-2 text-center font-mono text-[10px] font-bold text-black/40">
								{weekday}
							</p>
						{/each}
					</div>
					{#each calendarWeeks as week, weekIndex (weekIndex)}
						<div class="grid grid-cols-7">
							{#each week as day, dayIndex (dayIndex)}
								{#if day}
									{@const dayItems = itemsByDate[day] ?? []}
									{@const inTrip = dateTabs.includes(day)}
									<button
										type="button"
										class="min-h-20 border-b border-r border-black/5 p-1.5 text-left align-top transition hover:bg-[#fbffe8] {selectedDate ===
										day
											? 'bg-[#f4f8e8]'
											: ''}"
										onclick={() => pickCalendarDay(day)}
									>
										<span
											class="inline-grid size-5 place-items-center font-mono text-[10px] font-bold {inTrip
												? 'bg-[#d8ff36]'
												: 'text-black/40'}"
										>
											{Number(day.slice(8, 10))}
										</span>
										{#each dayItems.slice(0, 2) as item (item.id)}
											<p class="mt-0.5 truncate text-[10px] font-bold text-black/70">
												{item.startTime ? `${item.startTime} ` : ''}{item.title}
											</p>
										{/each}
										{#if dayItems.length > 2}
											<p class="mt-0.5 text-[10px] text-black/40">
												+{dayItems.length - 2} 個行程
											</p>
										{/if}
									</button>
								{:else}
									<div class="min-h-20 border-b border-r border-black/5 bg-[#fbfcf8]"></div>
								{/if}
							{/each}
						</div>
					{/each}
				</div>
			{:else}
				<div class="grid gap-3">
					{#if items.length === 0}
						<div
							class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
						>
							還沒有行程，從右側新增第一個安排。
						</div>
					{:else if visibleGroups.length === 0}
						<div
							class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
						>
							{selectedDate} 還沒有行程，從右側新增這一天的安排。
						</div>
					{/if}
					{#each visibleGroups as day (day.date)}
						<div class="mb-6 last:mb-0">
							<div class="mb-3 flex items-center gap-3">
								<span
									class="grid size-8 place-items-center bg-[#d8ff36] font-mono text-xs font-black"
								>
									{day.date.slice(8, 10)}
								</span>
								<div>
									<p class="font-mono text-xs font-bold tracking-widest text-[#779a00]">
										{day.date}
									</p>
									<p class="text-xs text-black/40">{day.items.length} 個行程</p>
								</div>
							</div>
							<div class="relative grid gap-3 border-l-2 border-[#d8ff36] pl-4">
								{#each day.items as item, itemIndex (item.id)}
									{#if itemIndex > 0}
										{@const previousItem = day.items[itemIndex - 1]}
										{@const segKey = segmentKey(previousItem, item)}
										{@const summary = segmentSummary[summaryKey(previousItem, item)]}
										{@const optionState = segmentOptions[segKey]}
										{@const ModeIcon = modeIcon(item.transportMode ?? 'drive')}
										<div>
											<div class="flex items-center gap-2 text-black/55">
												<ModeIcon class="size-3.5 shrink-0" />
												<span class="font-mono text-[11px] font-bold">
													{TRANSPORT_LABELS[item.transportMode ?? ''] ?? '開車'}
													{#if summary?.loading}
														· 查詢中…
													{:else if summary?.minutes != null}
														· {summary.minutes} 分
													{/if}
												</span>
												<button
													type="button"
													class="ml-auto font-mono text-[10px] font-bold text-black/40 hover:text-black"
													onclick={() => toggleSegment(previousItem, item)}
												>
													{expandedSegment === segKey ? '收合' : '其他方式'}
												</button>
											</div>
											{#if expandedSegment === segKey}
												<section
													class="mt-2 border border-black/10 bg-[#f7f8f4] p-3"
													aria-label={`${previousItem.title} 到 ${item.title} 的交通方案`}
												>
													<p class="truncate text-xs font-bold">
														{previousItem.title} → {item.title}
													</p>
													{#if optionState?.loading}
														<p class="mt-2 font-mono text-[10px] text-black/45">查詢中…</p>
													{/if}
													{#if optionState?.loaded}
														{#if optionState.error}
															<p class="mt-2 text-xs text-red-700">{optionState.error}</p>
														{:else}
															<div class="mt-2 grid gap-2 sm:grid-cols-3">
																<div class="border-l-4 border-orange-600 bg-white px-2.5 py-2">
																	<p class="text-xs font-bold">步行</p>
																	<p class="mt-0.5 text-[10px] text-black/50">
																		{optionState.walk
																			? `${optionState.walk.durationMinutes} 分 · ${optionState.walk.distanceKm} km`
																			: '查無路線'}
																	</p>
																</div>
																<div class="border-l-4 border-blue-600 bg-white px-2.5 py-2">
																	<p class="text-xs font-bold">開車</p>
																	<p class="mt-0.5 text-[10px] text-black/50">
																		{optionState.drive
																			? `${optionState.drive.durationMinutes} 分 · ${optionState.drive.distanceKm} km`
																			: '查無路線'}
																	</p>
																</div>
																<div class="border-l-4 border-violet-600 bg-white px-2.5 py-2">
																	<p class="text-xs font-bold">大眾運輸</p>
																	{#if optionState.transit}
																		<p class="mt-0.5 text-[10px] text-black/50">
																			{optionState.transit.durationMinutes
																				? `${optionState.transit.durationMinutes} 分`
																				: '有可用路線'}{optionState.transit.transfers != null
																				? ` · 轉乘 ${optionState.transit.transfers} 次`
																				: ''}
																		</p>
																		{#if optionState.transit.departureTime || optionState.transit.arrivalTime}
																			<p class="mt-0.5 text-[10px] text-black/50">
																				{formatClock(
																					optionState.transit.departureTime
																				)}–{formatClock(optionState.transit.arrivalTime)}
																			</p>
																		{/if}
																		{#if optionState.transit.services.length > 0}
																			<p
																				class="mt-0.5 break-words text-[10px] leading-4 font-bold text-violet-700"
																			>
																				搭乘：{optionState.transit.services.join(' → ')}
																			</p>
																		{/if}
																		{#if optionState.transit.fares.length > 0}
																			<p class="mt-1 text-[10px] font-bold text-black/70">
																				預估票價：{optionState.transit.fares
																					.map(formatFare)
																					.join(' / ')}
																			</p>
																			<p class="mt-0.5 text-[9px] text-black/35">
																				成人／預設票種；實際金額以營運單位為準
																			</p>
																		{:else}
																			<p class="mt-1 text-[10px] text-black/40">
																				票價：資料來源未提供
																			</p>
																		{/if}
																		<p class="mt-1 text-[9px] text-black/35">
																			來源：{optionState.transit.source}
																		</p>
																	{:else}
																		<p class="mt-0.5 text-[10px] text-black/50">查無路線</p>
																	{/if}
																</div>
															</div>
															<p class="mt-2 text-[10px] text-black/40">
																步行與開車為一般路網估時；大眾運輸班次與即時性依資料來源涵蓋範圍為準。
															</p>
														{/if}
													{/if}
												</section>
											{/if}
										</div>
									{/if}
									{#if editingId === item.id}
										<article class="grid gap-3 border border-black bg-white p-4">
											<div class="grid grid-cols-3 gap-3">
												<label class="grid gap-1.5 text-xs font-bold"
													>日期<Input
														type="date"
														bind:value={editForm.date}
														class="rounded-none border-black/20 bg-[#fbfcf8]"
													/></label
												>
												<label class="grid gap-1.5 text-xs font-bold"
													>開始<Input
														type="time"
														bind:value={editForm.startTime}
														class="rounded-none border-black/20 bg-[#fbfcf8]"
													/></label
												>
												<label class="grid gap-1.5 text-xs font-bold"
													>結束<Input
														type="time"
														bind:value={editForm.endTime}
														class="rounded-none border-black/20 bg-[#fbfcf8]"
													/></label
												>
											</div>
											<label class="grid gap-1.5 text-xs font-bold"
												>標題<Input
													bind:value={editForm.title}
													required
													class="rounded-none border-black/20 bg-[#fbfcf8]"
												/></label
											>
											<label class="grid gap-1.5 text-xs font-bold"
												>到這裡的方式<select
													bind:value={editForm.transportMode}
													class="h-10 border border-black/20 bg-[#fbfcf8] px-3 text-sm"
												>
													{#each TRANSPORT_OPTIONS as option (option.value)}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select></label
											>
											<label class="grid gap-1.5 text-xs font-bold"
												>備註<Textarea
													bind:value={editForm.notes}
													class="rounded-none border-black/20 bg-[#fbfcf8]"
												/></label
											>
											<!-- Place picker (edit) -->
											<div class="grid gap-1.5">
												<label for="edit-place" class="text-xs font-bold">地點</label>
												<div class="flex gap-2">
													<select
														id="edit-place"
														bind:value={editForm.placeId}
														class="h-10 flex-1 border border-black/20 bg-[#fbfcf8] px-3 text-sm"
													>
														<option value="">不指定地點</option>
														{#each places as p (p.id)}
															<option value={p.id}
																>{p.name}{p.address ? ` · ${p.address.split(',')[0]}` : ''}</option
															>
														{/each}
													</select>
													<button
														type="button"
														title="搜尋新地點"
														class="border border-black/20 px-3 text-black/50 hover:border-black hover:text-black"
														onclick={() => openNewPlace(true)}
													>
														<Search class="size-4" />
													</button>
												</div>
												{#if newPlace.show && newPlace.forEdit}
													<div class="grid gap-2 border border-black/10 bg-[#fbfcf8] p-3">
														<div class="relative">
															<Input
																bind:value={newPlace.query}
																placeholder="搜尋地點名稱…"
																class="rounded-none border-black/20 bg-white pr-8"
																oninput={onSearchInput}
															/>
															<div class="mt-2 grid gap-2 sm:grid-cols-3">
																<Input
																	bind:value={placeDetails.openingHours}
																	placeholder="營業時間"
																	class="rounded-none border-black/20 bg-white"
																/>
																<Input
																	bind:value={placeDetails.rating}
																	type="number"
																	min="0"
																	max="5"
																	step="0.1"
																	placeholder="評價 0–5"
																	class="rounded-none border-black/20 bg-white"
																/>
																<Input
																	bind:value={placeDetails.ratingCount}
																	type="number"
																	min="0"
																	placeholder="評價數"
																	class="rounded-none border-black/20 bg-white"
																/>
															</div>
															{#if newPlace.searching}
																<span
																	class="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-black/40"
																	>搜尋中</span
																>
															{/if}
														</div>
														{#if newPlace.results.length > 0}
															<div class="grid gap-1">
																{#each newPlace.results as r (r.placeId)}
																	<button
																		type="button"
																		onclick={() => selectSearchResult(r)}
																		class="border border-black/10 bg-white p-2 text-left hover:border-black/30"
																	>
																		<p class="text-xs font-bold">{r.name}</p>
																		<p class="mt-0.5 truncate font-mono text-[10px] text-black/45">
																			{r.displayName}
																		</p>
																	</button>
																{/each}
															</div>
														{/if}
														{#if newPlace.query.trim() && !newPlace.searching && newPlace.results.length === 0}
															<button
																type="button"
																onclick={createManualPlace}
																class="border border-black/20 py-1.5 font-mono text-xs text-black/60 hover:border-black hover:text-black"
															>
																直接新增「{newPlace.query.trim()}」
															</button>
														{/if}
													</div>
												{/if}
											</div>
											<div class="flex gap-2">
												<Button
													type="button"
													disabled={saving}
													class="h-9 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
													onclick={() => saveEdit(item.id)}
												>
													{saving ? '儲存中…' : '儲存'}
												</Button>
												<Button
													type="button"
													variant="outline"
													class="h-9 rounded-none font-bold"
													onclick={() => (editingId = null)}
												>
													<X class="size-4" /> 取消
												</Button>
											</div>
										</article>
									{:else}
										<article
											id={`itinerary-item-${item.id}`}
											class="flex gap-4 border bg-white p-4 transition {highlightedItemId ===
											item.id
												? 'border-[#779a00] ring-1 ring-[#779a00]'
												: 'border-black/10'}"
										>
											<button
												type="button"
												title="在地圖上顯示"
												disabled={!item.place || item.place.lat === null || item.place.lng === null}
												class="grid size-7 shrink-0 place-items-center font-mono text-xs font-black transition disabled:opacity-40 {highlightedItemId ===
												item.id
													? 'bg-[#d8ff36] text-black ring-1 ring-black'
													: 'bg-[#151817] text-white hover:bg-black'}"
												onclick={() => focusItemOnMap(item)}
											>
												{itemNumbers[item.id] ?? '·'}
											</button>
											<div class="min-w-0 flex-1">
												<p class="font-mono text-[11px] font-bold text-[#779a00]">
													{item.startTime
														? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}`
														: '全天'}
												</p>
												<h3 class="mt-0.5 font-bold">
													<!-- eslint-disable svelte/no-navigation-without-resolve -->
													<a
														href={`/trips/${data.trip.id}/itinerary/${item.id}`}
														class="hover:text-[#779a00]">{item.title}</a
													>
													<!-- eslint-enable svelte/no-navigation-without-resolve -->
												</h3>
												{#if item.place}
													<p class="mt-1 flex items-center gap-1 text-xs text-black/50">
														<MapPin class="size-3 shrink-0" />
														{item.place.name}{item.place.address
															? ` · ${item.place.address.split(',')[0]}`
															: ''}
													</p>
													{#if item.place.openingHours || item.place.rating !== null}
														<p class="mt-1 text-xs text-black/45">
															{#if item.place.openingHours}營業 {item.place.openingHours}{/if}
															{#if item.place.rating !== null}
																· 評價 {item.place.rating}{#if item.place.ratingCount !== null}
																	({item.place.ratingCount}){/if}
															{/if}
														</p>
													{/if}
												{/if}
												{#if item.notes}
													<p class="mt-1 text-sm leading-6 text-black/55">{item.notes}</p>
												{/if}
												{#if relatedCritical(item).length > 0}
													<div class="mt-3 border-t border-black/10 pt-3">
														<p
															class="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#779a00]"
														>
															<ShieldAlert class="size-3.5" /> 出發前需要確認
														</p>
														<div class="grid gap-1.5">
															{#each relatedCritical(item) as critical (critical.id)}
																{@const confirmed = critical.confirmations.some(
																	(confirmation) => confirmation.userId === data.user.id
																)}
																<!-- eslint-disable svelte/no-navigation-without-resolve -->
																<a
																	href={`/trips/${data.trip.id}/critical`}
																	class="flex items-center justify-between gap-3 text-sm hover:text-[#779a00]"
																>
																	<span class="min-w-0 truncate">{critical.name}</span>
																	<span
																		class="shrink-0 text-xs {confirmed
																			? 'text-[#779a00]'
																			: 'text-amber-600'}"
																	>
																		{confirmed ? '已確認' : '待確認'}
																	</span>
																</a>
																<!-- eslint-enable svelte/no-navigation-without-resolve -->
															{/each}
														</div>
													</div>
												{/if}
											</div>
											<div class="flex shrink-0 gap-1">
												{#if !readonly}
													{#if tidy}
														<ActionMenu
															actions={[
																{ label: '編輯', icon: Pencil, onClick: () => startEdit(item) },
																{
																	label: '刪除',
																	icon: Trash2,
																	danger: true,
																	onClick: () => remove(item.id)
																}
															]}
														/>
													{:else}
														<button
															type="button"
															title="編輯行程"
															class="text-black/35 hover:text-black"
															onclick={() => startEdit(item)}
														>
															<Pencil class="size-4" />
														</button>
														<button
															type="button"
															title="刪除行程"
															class="text-black/35 hover:text-red-600"
															onclick={() => remove(item.id)}
														>
															<Trash2 class="size-4" />
														</button>
													{/if}
												{/if}
											</div>
										</article>
									{/if}
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</section>

		<!-- Add form -->
		{#if readonly}
			<div class="h-fit border border-black/10 bg-white p-5 text-sm leading-6 text-black/50">
				這趟旅程已完成，行程保留為紀錄，無法再修改。
			</div>
		{:else}
			<form class="grid h-fit gap-4 border border-black/10 bg-white p-5" onsubmit={add}>
				<h3 class="flex items-center gap-2 text-lg font-black">
					<CalendarDays class="size-5 text-[#779a00]" /> 新增行程
				</h3>
				<label class="grid gap-2 text-sm font-bold"
					>日期<Input
						type="date"
						bind:value={form.date}
						required
						class="rounded-none border-black/20 bg-[#fbfcf8]"
					/></label
				>
				<div class="grid grid-cols-2 gap-3">
					<label class="grid gap-2 text-sm font-bold"
						>開始<Input
							type="time"
							bind:value={form.startTime}
							class="rounded-none border-black/20 bg-[#fbfcf8]"
						/></label
					><label class="grid gap-2 text-sm font-bold"
						>結束<Input
							type="time"
							bind:value={form.endTime}
							class="rounded-none border-black/20 bg-[#fbfcf8]"
						/></label
					>
				</div>
				<label class="grid gap-2 text-sm font-bold"
					>標題<Input
						bind:value={form.title}
						placeholder="例如：抵達機場"
						required
						class="rounded-none border-black/20 bg-[#fbfcf8]"
					/></label
				>
				<label class="grid gap-2 text-sm font-bold"
					>到這裡的方式<select
						bind:value={form.transportMode}
						class="h-10 border border-black/20 bg-[#fbfcf8] px-3 text-sm"
					>
						{#each TRANSPORT_OPTIONS as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select></label
				>
				<!-- Place picker (add) -->
				<div class="grid gap-2">
					<label for="add-place" class="text-sm font-bold">地點</label>
					<div class="flex gap-2">
						<select
							id="add-place"
							bind:value={form.placeId}
							class="h-10 flex-1 border border-black/20 bg-[#fbfcf8] px-3 text-sm"
						>
							<option value="">不指定地點</option>
							{#each places as p (p.id)}
								<option value={p.id}
									>{p.name}{p.address ? ` · ${p.address.split(',')[0]}` : ''}</option
								>
							{/each}
						</select>
						<button
							type="button"
							title="搜尋新地點"
							class="border border-black/20 px-3 text-black/50 hover:border-black hover:text-black"
							onclick={() => openNewPlace(false)}
						>
							<Search class="size-4" />
						</button>
					</div>
					{#if newPlace.show && !newPlace.forEdit}
						<div class="grid gap-2 border border-black/10 bg-[#f5f6f2] p-3">
							<div class="relative">
								<Input
									bind:value={newPlace.query}
									placeholder="搜尋地點名稱…"
									class="rounded-none border-black/20 bg-white pr-8"
									oninput={onSearchInput}
								/>
								<div class="mt-2 grid gap-2 sm:grid-cols-3">
									<Input
										bind:value={placeDetails.openingHours}
										placeholder="營業時間"
										class="rounded-none border-black/20 bg-white"
									/>
									<Input
										bind:value={placeDetails.rating}
										type="number"
										min="0"
										max="5"
										step="0.1"
										placeholder="評價 0–5"
										class="rounded-none border-black/20 bg-white"
									/>
									<Input
										bind:value={placeDetails.ratingCount}
										type="number"
										min="0"
										placeholder="評價數"
										class="rounded-none border-black/20 bg-white"
									/>
								</div>
								{#if newPlace.searching}
									<span
										class="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-black/40"
										>搜尋中</span
									>
								{/if}
							</div>
							{#if newPlace.results.length > 0}
								<div class="grid gap-1">
									{#each newPlace.results as r (r.placeId)}
										<button
											type="button"
											onclick={() => selectSearchResult(r)}
											class="border border-black/10 bg-white p-2 text-left hover:border-black/30"
										>
											<p class="text-xs font-bold">{r.name}</p>
											<p class="mt-0.5 truncate font-mono text-[10px] text-black/45">
												{r.displayName}
											</p>
										</button>
									{/each}
								</div>
							{/if}
							{#if newPlace.query.trim() && !newPlace.searching && newPlace.results.length === 0}
								<button
									type="button"
									onclick={createManualPlace}
									class="border border-black/20 py-1.5 font-mono text-xs text-black/60 hover:border-black hover:text-black"
								>
									直接新增「{newPlace.query.trim()}」
								</button>
							{/if}
						</div>
					{/if}
				</div>
				{#if insertSlots.length > 0}
					<div class="grid gap-2 border border-black/10 bg-[#f7f8f4] p-3">
						<p class="font-mono text-xs font-bold tracking-widest text-black/60">要加在哪？</p>
						{#each insertSlots as slot (slot.index)}
							<button
								type="button"
								class="grid gap-1 border p-2.5 text-left transition {insertChoice === slot.index
									? 'border-black bg-white'
									: 'border-black/10 bg-white/60 hover:border-black/40'}"
								onclick={() => pickSlot(slot)}
							>
								<span class="flex flex-wrap items-center gap-1 text-xs">
									<span class="truncate text-black/50">{slot.prev?.title ?? '當天開始'}</span>
									<span class="text-black/30">→</span>
									<span class="font-bold">{formPlace?.name}</span>
									<span class="text-black/30">→</span>
									<span class="truncate text-black/50">{slot.next?.title ?? '當天結束'}</span>
								</span>
								<span class="flex items-center gap-2">
									{#if slot.best}
										<span class="bg-[#d8ff36] px-1.5 py-0.5 font-mono text-[10px] font-bold"
											>加在這裡最順</span
										>
									{/if}
									{#if slot.detourKm !== null}
										<span class="font-mono text-[10px] text-black/40"
											>繞路約 {Math.round(slot.detourKm * 10) / 10} km</span
										>
									{/if}
									{#if slot.suggestedTime}
										<span class="font-mono text-[10px] text-black/40"
											>建議 {slot.suggestedTime}</span
										>
									{/if}
								</span>
							</button>
						{/each}
						<p class="text-[10px] text-black/40">
							依直線距離估算最順的插入位置；選擇後會自動帶入建議時間，可再調整。
						</p>
					</div>
				{/if}
				<label class="grid gap-2 text-sm font-bold"
					>備註<Textarea
						bind:value={form.notes}
						placeholder="地址、預約資訊或集合地點"
						class="rounded-none border-black/20 bg-[#fbfcf8]"
					/></label
				>
				<Button
					type="submit"
					disabled={saving}
					class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
					><Plus class="size-4" /> {saving ? '新增中…' : '加入行程'}</Button
				>
			</form>
		{/if}
	</div>
{/snippet}
