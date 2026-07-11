<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import type { PageData } from './$types'
	let { data }: { data: PageData } = $props()
	let title = $state('')
	let amount = $state('')
	let date = $state(new Date().toISOString().slice(0, 10))
	let notes = $state('')
	let message = $state('')
	async function submit(event: SubmitEvent) {
		event.preventDefault()
		const response = await fetch(`/api/trips/${data.trip.id}/bills`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				title,
				amount: Number(amount),
				date,
				currency: data.trip.currency,
				notes,
				payers: [{ userId: data.user.id, amount: Number(amount) }],
				participants: [{ userId: data.user.id }]
			})
		})
		if (response.ok) location.href = `/trips/${data.trip.id}/expenses`
		else message = '請確認費用名稱、金額與日期。'
	}
</script>

<main class="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
	<Button
		href={`/trips/${data.trip.id}/expenses`}
		variant="ghost"
		class="mb-8 h-9 rounded-none px-0 font-bold hover:bg-transparent"
		><ArrowLeft class="size-4" /> 返回費用</Button
	>
	<div class="border-b border-black/15 pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">新增 / 費用</p>
		<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">記錄一筆費用</h2>
	</div>
	<form class="mt-8 grid gap-5 border border-black/10 bg-white p-5 sm:p-8" onsubmit={submit}>
		{#if message}<p class="bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>{/if}<label
			class="grid gap-2 text-sm font-bold"
			>費用名稱<Input
				bind:value={title}
				placeholder="例如：住宿"
				required
				class="rounded-none border-black/20 bg-[#fbfcf8]"
			/></label
		>
		<div class="grid gap-4 sm:grid-cols-2">
			<label class="grid gap-2 text-sm font-bold"
				>金額<Input
					type="number"
					min="0.01"
					step="0.01"
					bind:value={amount}
					required
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/></label
			><label class="grid gap-2 text-sm font-bold"
				>日期<Input
					type="date"
					bind:value={date}
					required
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/></label
			>
		</div>
		<label class="grid gap-2 text-sm font-bold"
			>備註<Textarea bind:value={notes} class="rounded-none border-black/20 bg-[#fbfcf8]" /></label
		><Button
			type="submit"
			class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			>儲存費用</Button
		>
	</form>
</main>
