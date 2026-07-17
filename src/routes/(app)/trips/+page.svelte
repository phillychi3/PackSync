<script lang="ts">
	import { preloadCode } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { Button } from '$lib/components/ui/button'
	import { Card, CardContent } from '$lib/components/ui/card'
	import { isNetworkReachable } from '$lib/network'
	import { CalendarDays, MapPin, Plane, Plus, Settings, Users } from '@lucide/svelte'
	import type { PageData } from './$types'
	import { onMount } from 'svelte'

	let { data }: { data: PageData } = $props()

	const statusMeta = {
		planning: { label: '規劃中', class: 'bg-[#d8ff36] text-black' },
		ongoing: { label: '旅途中', class: 'bg-[#b8e600] text-black' },
		completed: { label: '已完成', class: 'bg-[#e5e7eb] text-[#374151]' }
	}

	const activeTrips = $derived(
		data.trips.filter((trip) => trip.status === 'planning' || trip.status === 'ongoing').length
	)
	const offlineSections = [
		'itinerary',
		'packing',
		'expenses',
		'todos',
		'critical',
		'members',
		'agent',
		'notifications'
	]
	const offlineResources = [
		'itinerary',
		'places',
		'critical',
		'packing',
		'bills',
		'settlements',
		'settlements/calculate',
		'members',
		'todos',
		'notifications',
		'agent'
	]

	function offlineUrls(tripId: string) {
		const base = `/trips/${tripId}`
		const apiBase = `/api/trips/${tripId}`

		return [
			base,
			...offlineSections.map((section) => `${base}/${section}`),
			`${base}/__data.json`,
			...offlineSections.map((section) => `${base}/${section}/__data.json`),
			...offlineResources.map((resource) => `${apiBase}/${resource}`)
		]
	}

	async function warmOfflineCache() {
		const cache = await caches.open('packsync-offline-v1')
		const urls = data.trips.flatMap((trip) => offlineUrls(trip.id))
		await Promise.allSettled(
			data.trips.flatMap((trip) => {
				const base = `/trips/${trip.id}`
				return [base, ...offlineSections.map((section) => `${base}/${section}`)].map((path) =>
					preloadCode(path)
				)
			})
		)
		await Promise.allSettled(
			urls.map(async (url) => {
				const isDocument = url.startsWith('/trips/') && !url.endsWith('/__data.json')
				const request = new Request(url, {
					credentials: 'same-origin',
					headers: isDocument ? { accept: 'text/html' } : undefined
				})
				const response = await fetch(request)
				if (!response.ok) return false
				await cache.put(request, response)
				return true
			})
		)
	}

	onMount(() => {
		void isNetworkReachable().then((online) => {
			if (online) void warmOfflineCache()
		})

	})

	function formatDate(value: string | null) {
		if (!value) return '尚未設定'

		return new Intl.DateTimeFormat('zh-TW', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		}).format(new Date(`${value}T00:00:00`))
	}

	function formatDateRange(startDate: string | null, endDate: string | null) {
		if (!startDate && !endDate) return '日期尚未設定'
		if (startDate && !endDate) return `${formatDate(startDate)} 開始`
		if (!startDate && endDate) return `${formatDate(endDate)} 結束`
		return `${formatDate(startDate)} - ${formatDate(endDate)}`
	}
</script>

<svelte:head>
	<title>旅程 | PackSync</title>
	<meta name="description" content="查看並管理你的 PackSync 旅程。" />
</svelte:head>

<main class="min-h-screen bg-[#f4f5f2] text-[#151817]">
	<section class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-12">
		<header
			class="flex flex-col gap-5 border-b border-black/10 pb-6 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">PACKSYNC / 旅程</p>
				<h1 class="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-6xl">我的旅程</h1>
				<p class="mt-3 max-w-2xl text-base leading-7 text-black/55">
					把共同計畫、清單、帳單與提醒，集中在每個旅程裡一起完成。
				</p>
			</div>
			<div class="flex gap-2">
				<Button
					href="/settings"
					variant="outline"
					class="h-11 justify-center rounded-none border-black/20 px-4 font-bold hover:border-black"
				>
					<Settings class="size-4" />
					設定
				</Button>
				<Button
					href="/trips/new"
					class="h-11 justify-center bg-[#d8ff36] px-4 font-bold text-black hover:bg-[#c8ef28]"
				>
					<Plus class="size-4" />
					新增旅程
				</Button>
			</div>
		</header>

		<div class="grid gap-3 sm:grid-cols-3">
			<div class="border border-black/10 bg-white p-4">
				<p class="font-mono text-[10px] font-bold tracking-[0.16em] text-black/40">全部旅程</p>
				<p class="mt-3 text-3xl font-black">{data.trips.length}</p>
			</div>
			<div class="border border-black/10 bg-white p-4">
				<p class="font-mono text-[10px] font-bold tracking-[0.16em] text-black/40">進行中</p>
				<p class="mt-3 text-3xl font-black">{activeTrips}</p>
			</div>
			<div class="border border-black/10 bg-white p-4">
				<p class="font-mono text-[10px] font-bold tracking-[0.16em] text-black/40">目前使用者</p>
				<p class="mt-3 truncate text-3xl font-black">{data.user.name ?? data.user.email}</p>
			</div>
		</div>

		{#if data.trips.length === 0}
			<section
				class="grid min-h-[420px] place-items-center border border-dashed border-black/20 bg-white px-6 py-14 text-center"
			>
				<div class="max-w-md">
					<div class="mx-auto grid size-14 place-items-center bg-[#d8ff36] text-black">
						<Plane class="size-7" />
					</div>
					<h2 class="mt-6 text-3xl font-black tracking-[-0.035em]">開始你的第一趟旅程</h2>
					<p class="mt-3 leading-7 text-black/55">
						建立一個旅程空間，管理日期、行李、費用、待辦事項，以及同行夥伴。
					</p>
					<Button
						href="/trips/new"
						class="mt-7 h-11 bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
					>
						<Plus class="size-4" />
						建立旅程
					</Button>
				</div>
			</section>
		{:else}
			<section class="grid gap-4 md:grid-cols-2">
				{#each data.trips as trip (trip.id)}
					<Card
						class="rounded-none border-black/10 bg-white shadow-none transition hover:border-black/30"
					>
						<CardContent class="p-0">
							<a href={resolve(`/trips/${trip.id}`)} class="block p-5">
								<div class="flex items-start justify-between gap-4">
									<div class="min-w-0">
										<p class="font-mono text-[10px] font-bold tracking-[0.16em] text-black/40">
											{trip.role.toUpperCase()}
										</p>
										<h2 class="mt-2 truncate text-2xl font-black tracking-[-0.035em]">
											{trip.name}
										</h2>
									</div>
									<span
										class={`shrink-0 px-2.5 py-1 text-xs font-bold ${statusMeta[trip.status].class}`}
									>
										{statusMeta[trip.status].label}
									</span>
								</div>

								<p class="mt-4 line-clamp-2 min-h-12 leading-6 text-black/55">
									{trip.description || '尚未新增描述。開啟旅程，開始建立共同計畫。'}
								</p>

								<div class="mt-6 grid gap-3 text-sm text-black/55">
									<p class="flex items-center gap-2">
										<MapPin class="size-4 text-black/35" />
										<span>{trip.destination || '目的地尚未設定'}</span>
									</p>
									<p class="flex items-center gap-2">
										<CalendarDays class="size-4 text-black/35" />
										<span>{formatDateRange(trip.startDate, trip.endDate)}</span>
									</p>
									<p class="flex items-center gap-2">
										<Users class="size-4 text-black/35" />
										<span>{trip.currency} 記帳空間</span>
									</p>
								</div>
							</a>
						</CardContent>
					</Card>
				{/each}
			</section>
		{/if}
	</section>
</main>
