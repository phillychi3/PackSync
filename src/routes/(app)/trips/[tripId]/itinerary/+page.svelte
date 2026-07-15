<script lang="ts">
	import type * as LType from 'leaflet'
	import 'leaflet/dist/leaflet.css'
	import markerIcon from 'leaflet/dist/images/marker-icon.png'
	import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
	import markerShadow from 'leaflet/dist/images/marker-shadow.png'
	import {
		CalendarDays,
		Crosshair,
		MapPin,
		Pencil,
		Plus,
		Search,
		ShieldAlert,
		Trash2,
		X
	} from '@lucide/svelte'
	import ActionMenu from '$lib/components/action-menu.svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { confirmDialog } from '$lib/stores/confirm'
	import { toast } from '$lib/stores/toast'
	import { offlineFetch } from '$lib/offline-fetch'
	import { setCriticalItems, setItinerary, setTripContext } from '$lib/stores/trip'
	import { onMount } from 'svelte'
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
		place: Place | null
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
	let form = $state({ date: '', startTime: '', endTime: '', title: '', notes: '', placeId: '' })
	let editingId = $state<string | null>(null)
	let editForm = $state({
		date: '',
		startTime: '',
		endTime: '',
		title: '',
		notes: '',
		placeId: ''
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

	let selectedDate = $state<string>('all')
	let highlightedItemId = $state<string | null>(null)
	let viewMode = $state<'list' | 'timeline'>('list')

	let dayGroups = $derived.by(() => {
		const groups = new Map<string, Item[]>()
		for (const item of sortItems(items)) {
			const day = groups.get(item.date) ?? []
			day.push(item)
			groups.set(item.date, day)
		}
		return [...groups.entries()].map(([date, dayItems]) => ({ date, items: dayItems }))
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
			const m = L.marker([p.lat, p.lng])
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
				const m = L.marker([p.lat!, p.lng!], { opacity: 0.5 })
					.bindPopup(
						`<b>${p.name}</b>${p.address ? '<br><span style="font-size:12px;color:#666">' + p.address + '</span>' : ''}`
					)
					.addTo(leafMap)
				mapMarkers.push(m)
			}
		}
		const routePoints = itinerary
			.filter((item) => item.place?.lat != null && item.place?.lng != null)
			.map((item) => [item.place!.lat!, item.place!.lng!] as [number, number])
		drawRoutes(routePoints)
		if (mapMarkers.length === 1) {
			leafMap.setView(mapMarkers[0].getLatLng(), 14)
		} else if (mapMarkers.length > 1) {
			const bounds = L.latLngBounds(mapMarkers.map((m) => m.getLatLng()))
			leafMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
		}
	})

	// Real route geometry via public OSRM; falls back to a dashed straight line
	const routeCache: Record<string, [number, number][]> = {}
	let routeGeneration = 0

	async function fetchRoute(
		from: [number, number],
		to: [number, number]
	): Promise<[number, number][] | null> {
		// Long segments (flights, ferries) don't have road routes
		if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) > 3) return null
		const key = `${from[0]},${from[1]};${to[0]},${to[1]}`
		if (routeCache[key]) return routeCache[key]
		try {
			const res = await fetch(
				`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`
			)
			if (!res.ok) return null
			const body = await res.json()
			const coords: [number, number][] | undefined = body.routes?.[0]?.geometry?.coordinates
			if (!coords || coords.length < 2) return null
			const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number])
			routeCache[key] = latLngs
			return latLngs
		} catch {
			return null
		}
	}

	async function drawRoutes(points: [number, number][]) {
		const generation = ++routeGeneration
		if (!L || !leafMap || points.length < 2) return
		for (let i = 0; i < points.length - 1; i++) {
			const geometry = await fetchRoute(points[i], points[i + 1])
			if (generation !== routeGeneration || !L || !leafMap) return
			const line = L.polyline(
				geometry ?? [points[i], points[i + 1]],
				geometry
					? { color: '#779a00', weight: 4, opacity: 0.8 }
					: { color: '#779a00', weight: 4, opacity: 0.75, dashArray: '8 8' }
			).addTo(leafMap)
			mapRoutes.push(line)
		}
	}

	function focusItemOnMap(item: Item) {
		const marker = itemMarkers[item.id]
		if (!marker || !leafMap) return
		highlightedItemId = item.id
		mapEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
		leafMap.setView(marker.getLatLng(), 16)
		marker.openPopup()
	}

	$effect(() => {
		if (!form.date && data.trip.startDate) form.date = data.trip.startDate
	})

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
			body: JSON.stringify({ ...form, placeId: form.placeId || null })
		})
		if (response.ok) {
			items = sortItems([...items, await response.json()])
			form = { ...form, title: '', notes: '', placeId: '' }
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
			placeId: item.placeId ?? ''
		}
	}

	async function saveEdit(id: string) {
		saving = true
		const res = await fetch(`/api/trips/${data.trip.id}/itinerary/${id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ ...editForm, placeId: editForm.placeId || null })
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
							placeId: target.placeId
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

		return () => leafMap?.remove()
	})
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<!-- Header -->
	<div class="border-b border-black/15 pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">01 / 行程</p>
		<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">每日安排</h2>
		<p class="mt-3 text-black/55">把景點、活動與移動安排在正確的日期。</p>
	</div>

	<!-- View toggle -->
	<div class="mt-6 flex gap-1">
		{#each [{ value: 'list', label: '清單' }, { value: 'timeline', label: '時間表' }] as mode (mode.value)}
			<button
				type="button"
				class="border px-3 py-1.5 font-mono text-xs font-bold transition {viewMode === mode.value
					? 'border-black bg-[#151817] text-white'
					: 'border-black/15 bg-white text-black/55 hover:border-black/40'}"
				onclick={() => (viewMode = mode.value as 'list' | 'timeline')}
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

	<!-- Map -->
	<div bind:this={mapEl} class="relative mt-3 h-64 w-full border border-black/10 sm:h-80">
		{#if !mapInitialized}
			<div class="absolute inset-0 grid place-items-center bg-[#eef0eb]">
				<span class="font-mono text-xs text-black/40">地圖載入中…</span>
			</div>
		{/if}
	</div>

	<!-- Items + Form -->
	<div class="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
		<!-- Items list -->
		<section>
			{#if viewMode === 'timeline'}
				<div class="border border-black/10 bg-white">
					<div class="flex items-center justify-between border-b border-black/10 px-4 py-3">
						<p class="font-mono text-xs font-bold text-[#779a00]">
							{timelineDay || '尚無日期'} · 時間表
						</p>
						<p class="text-xs text-black/40">{timelineItems.length + allDayItems.length} 個行程</p>
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
								{#each day.items as item (item.id)}
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
											<div class="w-24 shrink-0 border-r border-black/10 pr-4">
												<p class="font-mono text-xs font-bold text-[#779a00]">{item.date}</p>
												<p class="mt-2 text-sm text-black/50">{item.startTime || '全天'}</p>
											</div>
											<div class="min-w-0 flex-1">
												<h3 class="font-bold">
													<a
														href={`/trips/${data.trip.id}/itinerary/${item.id}`}
														class="hover:text-[#779a00]">{item.title}</a
													>
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
															{/each}
														</div>
													</div>
												{/if}
												{#if item.endTime}
													<p class="mt-2 text-xs text-black/40">結束於 {item.endTime}</p>
												{/if}
											</div>
											<div class="flex shrink-0 gap-1">
												{#if item.place && item.place.lat !== null && item.place.lng !== null}
													<button
														type="button"
														title="在地圖上顯示"
														class="text-black/35 hover:text-[#779a00]"
														onclick={() => focusItemOnMap(item)}
													>
														<Crosshair class="size-4" />
													</button>
												{/if}
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
</main>
