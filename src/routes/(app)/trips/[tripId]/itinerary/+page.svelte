<script lang="ts">
	import { CalendarDays, Plus, Trash2 } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Item = {
		id: string
		date: string
		startTime: string | null
		endTime: string | null
		title: string
		notes: string | null
	}
	let { data }: { data: PageData } = $props()
	let items = $state<Item[]>([])
	let form = $state({
		date: '',
		startTime: '',
		endTime: '',
		title: '',
		notes: ''
	})
	$effect(() => {
		if (!form.date && data.trip.startDate) form.date = data.trip.startDate
	})
	let saving = $state(false)

	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/itinerary`)
		if (response.ok) items = await response.json()
	}
	async function add(event: SubmitEvent) {
		event.preventDefault()
		if (!form.date || !form.title.trim()) return
		saving = true
		const response = await fetch(`/api/trips/${data.trip.id}/itinerary`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(form)
		})
		if (response.ok) {
			items = [...items, await response.json()].sort((a, b) => a.date.localeCompare(b.date))
			form = { ...form, title: '', notes: '' }
		}
		saving = false
	}
	async function remove(id: string) {
		if (!confirm('確定要刪除這個行程嗎？')) return
		await fetch(`/api/trips/${data.trip.id}/itinerary/${id}`, { method: 'DELETE' })
		items = items.filter((item) => item.id !== id)
	}
	onMount(load)
</script>

<main
	class="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_360px] lg:py-12"
>
	<section>
		<div class="border-b border-black/15 pb-6">
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">01 / 行程</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">每日安排</h2>
			<p class="mt-3 text-black/55">把景點、活動與移動安排在正確的日期。</p>
		</div>
		<div class="mt-6 grid gap-3">
			{#if items.length === 0}<div
					class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
				>
					還沒有行程，從右側新增第一個安排。
				</div>{/if}
			{#each items as item (item.id)}
				<article class="flex gap-4 border border-black/10 bg-white p-4">
					<div class="w-24 shrink-0 border-r border-black/10 pr-4">
						<p class="font-mono text-xs font-bold text-[#779a00]">{item.date}</p>
						<p class="mt-2 text-sm text-black/50">{item.startTime || '全天'}</p>
					</div>
					<div class="min-w-0 flex-1">
						<h3 class="font-bold">{item.title}</h3>
						{#if item.notes}<p class="mt-1 text-sm leading-6 text-black/55">
								{item.notes}
							</p>{/if}{#if item.endTime}<p class="mt-2 text-xs text-black/40">
								結束於 {item.endTime}
							</p>{/if}
					</div>
					<button
						type="button"
						title="刪除行程"
						class="shrink-0 text-black/35 hover:text-red-600"
						onclick={() => remove(item.id)}><Trash2 class="size-4" /></button
					>
				</article>
			{/each}
		</div>
	</section>
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
</main>
