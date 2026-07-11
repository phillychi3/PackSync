<script lang="ts">
	import { ArrowLeft, Trash2 } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import type { PageData } from './$types'
	type Bill = {
		title: string
		amount: number
		currency: string
		date: string
		notes: string | null
	}
	let { data, params }: { data: PageData; params: { billId: string } } = $props()
	let bill = $state<Bill | null>(null)
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/bills/${params.billId}`)
		if (response.ok) bill = await response.json()
	}
	async function remove() {
		if (!confirm('確定要刪除這筆費用嗎？')) return
		await fetch(`/api/trips/${data.trip.id}/bills/${params.billId}`, { method: 'DELETE' })
		location.href = `/trips/${data.trip.id}/expenses`
	}
	onMount(load)
</script>

<main class="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
	<Button
		href={`/trips/${data.trip.id}/expenses`}
		variant="ghost"
		class="mb-8 h-9 rounded-none px-0 font-bold hover:bg-transparent"
		><ArrowLeft class="size-4" /> 返回費用</Button
	>{#if bill}<article class="border border-black/10 bg-white p-6 sm:p-8">
			<div class="flex items-start justify-between gap-5 border-b border-black/10 pb-6">
				<div>
					<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">
						費用明細 / {bill.date}
					</p>
					<h2 class="mt-3 text-4xl font-black">{bill.title}</h2>
				</div>
				<p class="font-mono text-2xl font-black">{bill.currency} {bill.amount.toFixed(2)}</p>
			</div>
			{#if bill.notes}<p class="mt-6 leading-7 text-black/60">{bill.notes}</p>{/if}
			<div class="mt-8 border-t border-black/10 pt-5">
				<Button
					type="button"
					variant="outline"
					class="rounded-none border-red-200 font-bold text-red-600 hover:bg-red-50"
					onclick={remove}><Trash2 class="size-4" /> 刪除費用</Button
				>
			</div>
		</article>{:else}<div
			class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50"
		>
			載入費用中…
		</div>{/if}
</main>
