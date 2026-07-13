<script lang="ts">
	import { ArrowLeft, Check, MapPin, ShieldAlert } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Place = {
		name: string
		address: string | null
		openingHours: string | null
		rating: number | null
		ratingCount: number | null
	}
	type Schedule = {
		id: string
		date: string
		startTime: string | null
		endTime: string | null
		title: string
		notes: string | null
		place: Place | null
	}
	type Critical = {
		id: string
		name: string
		description: string | null
		scheduleItemId: string | null
		confirmations: { userId: string; scheduleItemId: string | null }[]
	}

	let { data, params }: { data: PageData; params: { itemId: string } } = $props()
	let schedule = $state<Schedule | null>(null)
	let criticalItems = $state<Critical[]>([])
	let loading = $state(true)
	let savingId = $state<string | null>(null)

	function relevantCritical() {
		return criticalItems.filter(
			(item) => item.scheduleItemId === null || item.scheduleItemId === params.itemId
		)
	}

	function isConfirmed(item: Critical) {
		return item.confirmations.some(
			(confirmation) =>
				confirmation.userId === data.user.id && confirmation.scheduleItemId === params.itemId
		)
	}

	async function load() {
		const [scheduleRes, criticalRes] = await Promise.all([
			fetch(`/api/trips/${data.trip.id}/itinerary/${params.itemId}`),
			fetch(`/api/trips/${data.trip.id}/critical`)
		])
		if (scheduleRes.ok) schedule = await scheduleRes.json()
		if (criticalRes.ok) criticalItems = await criticalRes.json()
		loading = false
	}

	async function toggleConfirmation(item: Critical) {
		savingId = item.id
		const confirmed = isConfirmed(item)
		const response = await fetch(`/api/trips/${data.trip.id}/critical/${item.id}/confirm`, {
			method: confirmed ? 'DELETE' : 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ scheduleItemId: params.itemId })
		})
		if (response.ok) await load()
		savingId = null
	}

	onMount(load)
</script>

<svelte:head><title>{schedule?.title ?? '行程詳細'} | {data.trip.name}</title></svelte:head>

<main class="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
	<a
		href={`/trips/${data.trip.id}/itinerary`}
		class="mb-6 inline-flex items-center gap-2 text-sm text-black/55 hover:text-black"
	>
		<ArrowLeft class="size-4" /> 回到行程
	</a>

	{#if loading}
		<div class="border border-black/10 bg-white p-6 text-black/50">載入行程中…</div>
	{:else if !schedule}
		<div class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50">
			找不到這個行程。
		</div>
	{:else}
		<section class="border border-black/10 bg-white p-6 sm:p-8">
			<p class="font-mono text-xs font-bold tracking-widest text-[#779a00]">{schedule.date}</p>
			<h1 class="mt-3 text-4xl font-black tracking-[-0.05em]">{schedule.title}</h1>
			<p class="mt-3 text-black/55">
				{schedule.startTime ?? '全天'}{schedule.endTime ? ` – ${schedule.endTime}` : ''}
			</p>
			{#if schedule.place}
				<p class="mt-4 flex items-center gap-2 text-sm text-black/60">
					<MapPin class="size-4" />
					{schedule.place.name}{schedule.place.address ? ` · ${schedule.place.address}` : ''}
				</p>
				{#if schedule.place.openingHours || schedule.place.rating !== null}
					<p class="mt-2 text-sm text-black/50">
						{#if schedule.place.openingHours}營業時間：{schedule.place.openingHours}{/if}
						{#if schedule.place.rating !== null}
							{#if schedule.place.openingHours}
								·
							{/if}評價：{schedule.place.rating}
							{#if schedule.place.ratingCount !== null}（{schedule.place.ratingCount} 則）{/if}
						{/if}
					</p>
				{/if}
			{/if}
			{#if schedule.notes}<p class="mt-5 whitespace-pre-wrap leading-7 text-black/65">
					{schedule.notes}
				</p>{/if}
		</section>

		<section class="mt-6 border border-black/10 bg-white p-6 sm:p-8">
			<div class="flex items-center gap-3">
				<div class="grid size-10 place-items-center bg-[#d8ff36]">
					<ShieldAlert class="size-5" />
				</div>
				<div>
					<h2 class="text-xl font-black">出發前需要確認</h2>
					<p class="mt-1 text-sm text-black/50">這些重要事項需要在本行程中分開確認。</p>
				</div>
			</div>

			{#if relevantCritical().length === 0}
				<p class="mt-6 text-sm text-black/50">這個行程目前沒有設定需要提醒的物品。</p>
			{:else}
				<div class="mt-6 grid gap-3">
					{#each relevantCritical() as item (item.id)}
						{@const confirmed = isConfirmed(item)}
						<div class="flex items-center gap-3 border border-black/10 p-4">
							<div
								class="grid size-9 shrink-0 place-items-center {confirmed
									? 'bg-[#d8ff36]'
									: 'border border-black/15'}"
							>
								{#if confirmed}<Check class="size-4" />{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="font-bold">{item.name}</p>
								{#if item.description}<p class="mt-1 text-sm text-black/50">
										{item.description}
									</p>{/if}
							</div>
							<button
								type="button"
								disabled={savingId === item.id}
								onclick={() => toggleConfirmation(item)}
								class="border px-3 py-2 text-xs font-bold {confirmed
									? 'border-[#779a00] text-[#779a00]'
									: 'border-black/20 text-black/60 hover:border-black'}"
							>
								{savingId === item.id ? '儲存中…' : confirmed ? '取消確認' : '確認已準備'}
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</main>
