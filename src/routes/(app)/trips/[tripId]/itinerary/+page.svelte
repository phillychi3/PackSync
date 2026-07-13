<script lang="ts">
	import type * as LType from 'leaflet'
	import {
		CalendarDays,
		MapPin,
		Pencil,
		Plus,
		Search,
		ShieldAlert,
		Trash2,
		X
	} from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
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

	let dayGroups = $derived.by(() => {
		const groups = new Map<string, Item[]>()
		for (const item of sortItems(items)) {
			const day = groups.get(item.date) ?? []
			day.push(item)
			groups.set(item.date, day)
		}
		return [...groups.entries()].map(([date, dayItems]) => ({ date, items: dayItems }))
	})

	function relatedCritical(item: Item) {
		return criticalItems.filter(
			(critical) => critical.scheduleItemId === null || critical.scheduleItemId === item.id
		)
	}

	$effect(() => {
		if (!mapInitialized) return
		const ps = places
		const itinerary = sortItems(items)
		if (!L || !leafMap) return
		mapMarkers.forEach((m) => m.remove())
		mapMarkers = []
		mapRoutes.forEach((route) => route.remove())
		mapRoutes = []
		const withCoords = ps.filter((p) => p.lat !== null && p.lng !== null)
		for (const p of withCoords) {
			const m = L.marker([p.lat!, p.lng!])
				.bindPopup(
					`<b>${p.name}</b>${p.address ? '<br><span style="font-size:12px;color:#666">' + p.address + '</span>' : ''}`
				)
				.addTo(leafMap)
			mapMarkers.push(m)
		}
		const routePoints = itinerary
			.filter((item) => item.place?.lat != null && item.place?.lng != null)
			.map((item) => [item.place!.lat!, item.place!.lng!] as [number, number])
		if (routePoints.length >= 2) {
			mapRoutes.push(
				L.polyline(routePoints, {
					color: '#779a00',
					weight: 4,
					opacity: 0.75,
					dashArray: '8 8'
				}).addTo(leafMap)
			)
		}
		if (mapMarkers.length === 1) {
			leafMap.setView(mapMarkers[0].getLatLng(), 14)
		} else if (mapMarkers.length > 1) {
			const bounds = L.latLngBounds(mapMarkers.map((m) => m.getLatLng()))
			leafMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
		}
	})

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
			fetch(`/api/trips/${data.trip.id}/itinerary`),
			fetch(`/api/trips/${data.trip.id}/places`),
			fetch(`/api/trips/${data.trip.id}/critical`)
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
		}
		saving = false
	}

	async function remove(id: string) {
		if (!confirm('確定要刪除這個行程嗎？')) return
		await fetch(`/api/trips/${data.trip.id}/itinerary/${id}`, { method: 'DELETE' })
		items = items.filter((item) => item.id !== id)
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

			// Fix bundler icon paths
			const icons = L.Icon.Default as unknown as { prototype: Record<string, unknown> }
			delete icons.prototype['_getIconUrl']
			L.Icon.Default.mergeOptions({
				iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
				iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
				shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
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

<svelte:head>
	<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<!-- Header -->
	<div class="border-b border-black/15 pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">01 / 行程</p>
		<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">每日安排</h2>
		<p class="mt-3 text-black/55">把景點、活動與移動安排在正確的日期。</p>
	</div>

	<!-- Map -->
	<div bind:this={mapEl} class="relative mt-6 h-64 w-full border border-black/10 sm:h-80">
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
			<div class="grid gap-3">
				{#if items.length === 0}
					<div class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50">
						還沒有行程，從右側新增第一個安排。
					</div>
				{/if}
				{#each dayGroups as day}
					<div class="mb-6 last:mb-0">
						<div class="mb-3 flex items-center gap-3">
							<span
								class="grid size-8 place-items-center bg-[#d8ff36] font-mono text-xs font-black"
							>
								{day.date.slice(8, 10)}
							</span>
							<div>
								<p class="font-mono text-xs font-bold tracking-widest text-[#779a00]">{day.date}</p>
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
									<article class="flex gap-4 border border-black/10 bg-white p-4">
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
										</div>
									</article>
								{/if}
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>

		<!-- Add form -->
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
	</div>
</main>
