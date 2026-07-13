<script lang="ts">
	import { Check, Plus, Trash2 } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import type { PageData } from './$types'
	type Item = {
		id: string
		name: string
		quantity: number
		isChecked: boolean
		notes: string | null
	}
	type List = { id: string; name: string; items: Item[] }
	let { data }: { data: PageData } = $props()
	let lists = $state<List[]>([])
	let listName = $state('')
	let itemName = $state('')
	let itemQuantity = $state('1')
	let selectedList = $state('')
	let selectedListData = $derived(lists.find((list) => list.id === selectedList))
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/packing`)
		if (response.ok) {
			lists = await response.json()
			selectedList = lists[0]?.id ?? ''
		}
	}
	async function addList(event: SubmitEvent) {
		event.preventDefault()
		const response = await fetch(`/api/trips/${data.trip.id}/packing`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: listName || '共同行李' })
		})
		if (response.ok) {
			const list = await response.json()
			lists = [...lists, { ...list, items: [] }]
			selectedList = list.id
			listName = ''
		}
	}
	async function removeList(listId: string) {
		if (!confirm('確定要刪除這個清單嗎？所有物品也會一起刪除。')) return
		const res = await fetch(`/api/trips/${data.trip.id}/packing/${listId}`, { method: 'DELETE' })
		if (res.ok) {
			lists = lists.filter((l) => l.id !== listId)
			if (selectedList === listId) selectedList = lists[0]?.id ?? ''
		}
	}
	async function addItem(event: SubmitEvent) {
		event.preventDefault()
		if (!itemName.trim() || !selectedList) return
		const response = await fetch(`/api/trips/${data.trip.id}/packing/${selectedList}/items`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				name: itemName,
				quantity: Math.max(1, Number(itemQuantity) || 1)
			})
		})
		if (response.ok) {
			const item = await response.json()
			if (selectedListData) selectedListData.items = [...selectedListData.items, item]
			itemName = ''
			itemQuantity = '1'
		}
	}
	async function toggle(item: Item) {
		const response = await fetch(
			`/api/trips/${data.trip.id}/packing/${selectedList}/items/${item.id}`,
			{
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ isChecked: !item.isChecked })
			}
		)
		if (response.ok) item.isChecked = !item.isChecked
	}
	async function remove(item: Item) {
		await fetch(`/api/trips/${data.trip.id}/packing/${selectedList}/items/${item.id}`, {
			method: 'DELETE'
		})
		if (selectedListData)
			selectedListData.items = selectedListData.items.filter((entry) => entry.id !== item.id)
	}
	onMount(load)
</script>

<main
	class="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[280px_1fr] lg:py-12"
>
	<aside>
		<div class="border-b border-black/15 pb-6">
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">03 / 行李</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">一起打包</h2>
			<p class="mt-3 text-black/55">建立不同清單，分配每件要帶的物品。</p>
		</div>
		<form class="mt-6 flex gap-2" onsubmit={addList}>
			<Input
				bind:value={listName}
				placeholder="新增清單"
				class="rounded-none border-black/20 bg-white"
			/><Button
				type="submit"
				size="icon"
				class="rounded-none bg-[#d8ff36] text-black hover:bg-[#c8ef28]"
				title="新增清單"><Plus class="size-4" /></Button
			>
		</form>
		<div class="mt-4 grid gap-1">
			{#each lists as list (list.id)}
				<div class="flex items-center gap-1">
					<button
						type="button"
						class="flex flex-1 items-center justify-between border px-3 py-3 text-left text-sm font-bold {selectedList ===
						list.id
							? 'border-black bg-white'
							: 'border-transparent text-black/55 hover:bg-white'}"
						onclick={() => (selectedList = list.id)}
					>
						<span>{list.name}</span>
						<span class="font-mono text-xs">{list.items.length}</span>
					</button>
					<button
						type="button"
						title="刪除清單"
						class="shrink-0 p-2 text-black/30 hover:text-red-600"
						onclick={() => removeList(list.id)}
					>
						<Trash2 class="size-4" />
					</button>
				</div>
			{/each}
		</div>
	</aside>
	<section class="border border-black/10 bg-white p-5 sm:p-7">
		{#if selectedListData}
			<div class="flex items-end justify-between border-b border-black/10 pb-5">
				<div>
					<p class="font-mono text-xs font-bold tracking-[0.16em] text-black/40">PACKING LIST</p>
					<h3 class="mt-2 text-2xl font-black">{selectedListData.name}</h3>
				</div>
				<span class="text-sm text-black/45"
					>{selectedListData.items.filter((item) => item.isChecked).length} / {selectedListData
						.items.length} 已完成</span
				>
			</div>
			<form class="mt-5 grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px_auto]" onsubmit={addItem}>
				<Input
					bind:value={itemName}
					placeholder="加入物品，例如：護照"
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/><Input
					type="number"
					min="1"
					bind:value={itemQuantity}
					aria-label="數量"
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/><Button
					type="submit"
					class="rounded-none bg-[#151817] px-4 font-bold text-white hover:bg-black"
					><Plus class="size-4" /> 加入</Button
				>
			</form>
			<div class="mt-5 grid gap-2">
				{#each selectedListData.items as item (item.id)}
					<div class="flex items-center gap-3 border-b border-black/10 py-3">
						<button
							type="button"
							title="標記已打包"
							class="grid size-6 place-items-center border {item.isChecked
								? 'border-[#779a00] bg-[#d8ff36]'
								: 'border-black/25'}"
							onclick={() => toggle(item)}
						>
							{#if item.isChecked}<Check class="size-4" />{/if}
						</button>
						<span
							class="min-w-0 flex-1 text-sm font-bold {item.isChecked
								? 'text-black/35 line-through'
								: ''}"
							>{item.name}
							<span class="ml-2 font-mono text-xs font-normal text-black/45">× {item.quantity}</span
							>
						</span>
						<button
							type="button"
							title="刪除物品"
							class="text-black/35 hover:text-red-600"
							onclick={() => remove(item)}><Trash2 class="size-4" /></button
						>
					</div>
				{/each}
			</div>
		{:else}
			<div class="grid min-h-64 place-items-center text-center text-black/45">
				還沒有行李清單，先從左側建立一個吧。
			</div>
		{/if}
	</section>
</main>
