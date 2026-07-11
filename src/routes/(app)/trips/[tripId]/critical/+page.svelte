<script lang="ts">
	import { Check, Plus } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import type { PageData } from './$types'
	type Critical = {
		id: string
		name: string
		description: string | null
		confirmations: { userId: string }[]
	}
	let { data }: { data: PageData } = $props()
	let items = $state<Critical[]>([])
	let name = $state('')
	let description = $state('')
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/critical`)
		if (response.ok) items = await response.json()
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
		<div class="mt-6 grid gap-3">
			{#each items as item (item.id)}<article class="border border-black/10 bg-white p-5">
					<div class="flex items-start gap-3">
						<div class="grid size-10 shrink-0 place-items-center bg-[#d8ff36]">
							<Check class="size-5" />
						</div>
						<div>
							<h3 class="font-bold">{item.name}</h3>
							{#if item.description}<p class="mt-1 text-sm leading-6 text-black/55">
									{item.description}
								</p>{/if}
							<p class="mt-3 text-xs font-bold text-[#779a00]">
								{item.confirmations.length} 位成員已確認
							</p>
						</div>
					</div>
				</article>{/each}{#if items.length === 0}<div
					class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
				>
					還沒有重要事項。
				</div>{/if}
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
