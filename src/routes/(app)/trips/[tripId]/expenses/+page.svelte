<script lang="ts">
	import { resolve } from '$app/paths'
	import { CircleDollarSign, Plus } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import type { PageData } from './$types'
	type Bill = {
		id: string
		title: string
		amount: number
		currency: string
		date: string
		category: string | null
	}
	let { data }: { data: PageData } = $props()
	let bills = $state<Bill[]>([])
	let total = $derived(bills.reduce((sum, bill) => sum + bill.amount, 0))
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/bills`)
		if (response.ok) bills = await response.json()
	}
	onMount(load)
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<div
		class="flex flex-col gap-5 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">05 / 費用</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">共同花費</h2>
			<p class="mt-3 text-black/55">記錄每一筆支出，讓最後的分攤更清楚。</p>
		</div>
		<Button
			href={resolve(`/trips/${data.trip.id}/expenses/new`)}
			class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			><Plus class="size-4" /> 新增費用</Button
		>
	</div>
	<div class="mt-8 grid gap-3 sm:grid-cols-3">
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">總支出</p>
			<p class="mt-3 text-3xl font-black">{data.trip.currency} {total.toFixed(2)}</p>
		</div>
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">筆數</p>
			<p class="mt-3 text-3xl font-black">{bills.length}</p>
		</div>
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">分攤狀態</p>
			<p class="mt-3 text-xl font-black">待計算</p>
		</div>
	</div>
	<section class="mt-8 grid gap-2">
		{#each bills as bill (bill.id)}<a
				href={resolve(`/trips/${data.trip.id}/expenses/${bill.id}`)}
				class="flex items-center gap-4 border border-black/10 bg-white p-4 transition hover:border-black/30"
				><span class="grid size-10 place-items-center bg-[#eef0eb]"
					><CircleDollarSign class="size-5 text-[#779a00]" /></span
				><span class="min-w-0 flex-1"
					><span class="block truncate font-bold">{bill.title}</span><span
						class="mt-1 block text-xs text-black/45"
						>{bill.date}{bill.category ? ` · ${bill.category}` : ''}</span
					></span
				><span class="font-mono font-bold">{bill.currency} {bill.amount.toFixed(2)}</span></a
			>{/each}{#if bills.length === 0}<div
				class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50"
			>
				還沒有費用紀錄。
			</div>{/if}
	</section>
</main>
