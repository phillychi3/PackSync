<script lang="ts">
	import { Check, Plus, Trash2 } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import type { PageData } from './$types'
	type Critical = {
		id: string
		name: string
		description: string | null
		scheduleItemId: string | null
		confirmations: {
			userId: string
			confirmedAt: string | number | Date
			scheduleItemId: string | null
			scheduleItem: Schedule | null
		}[]
	}
	type Schedule = {
		id: string
		date: string
		title: string
		startTime: string | null
		transportMode: string | null
	}
	let { data }: { data: PageData } = $props()
	let items = $state<Critical[]>([])
	let name = $state('')
	let description = $state('')
	let scheduleItems = $state<Schedule[]>([])
	let stageFilter = $state('all')
	function itemSchedule(item: Critical) {
		return scheduleItems.find((schedule) => schedule.id === item.scheduleItemId) ?? null
	}
	let groupedItems = $derived.by(() => {
		const groups = new Map<string, Critical[]>()
		for (const item of items) {
			const schedule = itemSchedule(item)
			const key = schedule ? stageLabel(schedule) : '全部情境'
			if (stageFilter !== 'all' && key !== stageFilter) continue
			groups.set(key, [...(groups.get(key) ?? []), item])
		}
		return [...groups.entries()]
	})

	async function load() {
		const [response, scheduleResponse] = await Promise.all([
			fetch(`/api/trips/${data.trip.id}/critical`),
			fetch(`/api/trips/${data.trip.id}/itinerary`)
		])
		if (response.ok) items = await response.json()
		if (scheduleResponse.ok) scheduleItems = await scheduleResponse.json()
	}
	async function add(event: SubmitEvent) {
		event.preventDefault()
		if (!name.trim()) return
		const response = await fetch(`/api/trips/${data.trip.id}/critical`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name, description })
		})
		if (response.ok) {
			items = [...items, { ...(await response.json()), confirmations: [] }]
			name = ''
			description = ''
		}
	}
	async function remove(id: string) {
		if (!confirm('確定要刪除這個事項嗎？')) return
		const res = await fetch(`/api/trips/${data.trip.id}/critical/${id}`, { method: 'DELETE' })
		if (res.ok) items = items.filter((i) => i.id !== id)
	}
	async function saveSchedule(item: Critical, selectedScheduleId: string) {
		const res = await fetch(`/api/trips/${data.trip.id}/critical/${item.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ scheduleItemId: selectedScheduleId || null })
		})
		if (res.ok) await load()
	}
	function stageLabel(schedule: Schedule) {
		if (schedule.transportMode) return `交通 · ${schedule.transportMode}`
		if (/住宿|飯店|旅館|hotel/i.test(schedule.title)) return '住宿'
		return '行程'
	}
	onMount(load)
</script>

<main
	class="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_360px] lg:py-12"
>
	<section>
		<div class="border-b border-black/15 pb-6">
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">04 / 重要事項</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">出發前確認</h2>
			<p class="mt-3 text-black/55">把護照、訂單與其他不能遺漏的事項集中管理。</p>
		</div>
		<div class="mt-5 flex items-center gap-3">
			<label class="text-sm font-bold" for="stage-filter">分組</label>
			<select
				id="stage-filter"
				bind:value={stageFilter}
				class="h-9 border border-black/20 bg-white px-3 text-sm"
			>
				<option value="all">全部情境</option>
				{#each [...new Set(items.flatMap((item) => {
							const schedule = itemSchedule(item)
							return schedule ? [stageLabel(schedule)] : []
						}))] as stage}
					<option value={stage}>{stage}</option>
				{/each}
			</select>
		</div>
		<div class="mt-6 grid gap-3">
			{#each groupedItems as [group, groupItems]}
				<div>
					<h3 class="mb-2 font-mono text-xs font-bold tracking-widest text-black/45">{group}</h3>
					<div class="grid gap-3">
						{#each groupItems as item (item.id)}
							<article class="border border-black/10 bg-white p-5">
								<div class="flex items-start gap-3">
									<div
										class="grid size-10 shrink-0 place-items-center border border-black/15 bg-white"
									>
										<Check class="size-5 text-[#779a00]" />
									</div>
									<div class="min-w-0 flex-1">
										<h3 class="font-bold">{item.name}</h3>
										{#if item.description}
											<p class="mt-1 text-sm leading-6 text-black/55">{item.description}</p>
										{/if}
										<p class="mt-3 text-xs text-[#779a00]">選擇情境後，會在對應行程中提醒攜帶</p>
									</div>
									<div class="flex shrink-0 flex-wrap justify-end gap-2">
										<select
											value={item.scheduleItemId ?? ''}
											class="h-8 max-w-40 border border-black/20 bg-white px-2 text-xs"
											onchange={(event) =>
												saveSchedule(item, (event.currentTarget as HTMLSelectElement).value)}
										>
											<option value="">全部情境</option>
											{#each scheduleItems as schedule (schedule.id)}
												<option value={schedule.id}>{schedule.date} · {schedule.title}</option>
											{/each}
										</select>
										<button
											type="button"
											title="刪除事項"
											class="text-black/30 hover:text-red-600"
											onclick={() => remove(item.id)}
										>
											<Trash2 class="size-4" />
										</button>
									</div>
								</div>
							</article>
						{/each}
					</div>
				</div>
			{/each}
			{#if items.length === 0}
				<div class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50">
					還沒有重要事項。
				</div>
			{/if}
		</div>
	</section>
	<form class="grid h-fit gap-4 border border-black/10 bg-white p-5" onsubmit={add}>
		<h3 class="text-lg font-black">新增重要事項</h3>
		<Input
			bind:value={name}
			placeholder="例如：護照與簽證"
			required
			class="rounded-none border-black/20 bg-[#fbfcf8]"
		/><Textarea
			bind:value={description}
			placeholder="補充說明"
			class="rounded-none border-black/20 bg-[#fbfcf8]"
		/><Button
			type="submit"
			class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			><Plus class="size-4" /> 新增事項</Button
		>
	</form>
</main>
