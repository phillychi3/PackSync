<script lang="ts">
	import { Check, Plus, Trash2 } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'
	type Todo = { id: string; title: string; dueDate: string | null; isCompleted: boolean }
	let { data }: { data: PageData } = $props()
	let todos = $state<Todo[]>([])
	let title = $state('')
	let dueDate = $state('')
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/todos`)
		if (response.ok) todos = await response.json()
	}
	async function add(event: SubmitEvent) {
		event.preventDefault()
		if (!title.trim()) return
		const response = await fetch(`/api/trips/${data.trip.id}/todos`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ title, dueDate: dueDate || null })
		})
		if (response.ok) {
			todos = [...todos, await response.json()]
			title = ''
			dueDate = ''
		}
	}
	async function toggle(item: Todo) {
		const response = await fetch(`/api/trips/${data.trip.id}/todos/${item.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isCompleted: !item.isCompleted })
		})
		if (response.ok) item.isCompleted = !item.isCompleted
	}
	async function remove(id: string) {
		await fetch(`/api/trips/${data.trip.id}/todos/${id}`, { method: 'DELETE' })
		todos = todos.filter((item) => item.id !== id)
	}
	onMount(load)
</script>

<main
	class="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1fr_360px] lg:py-12"
>
	<section>
		<div class="border-b border-black/15 pb-6">
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">02 / 待辦</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">出發前清單</h2>
			<p class="mt-3 text-black/55">把大家要完成的事情放在一起。</p>
		</div>
		<div class="mt-6 grid gap-2">
			{#each todos as item (item.id)}<div
					class="flex items-center gap-3 border border-black/10 bg-white p-4"
				>
					<button
						type="button"
						title="標記完成"
						class={`grid size-6 shrink-0 place-items-center border ${item.isCompleted ? 'border-[#779a00] bg-[#d8ff36]' : 'border-black/25'}`}
						onclick={() => toggle(item)}
						>{#if item.isCompleted}<Check class="size-4" />{/if}</button
					>
					<div class="min-w-0 flex-1">
						<p class={`font-bold ${item.isCompleted ? 'text-black/35 line-through' : ''}`}>
							{item.title}
						</p>
						{#if item.dueDate}<p class="mt-1 text-xs text-black/45">期限：{item.dueDate}</p>{/if}
					</div>
					<button
						type="button"
						title="刪除待辦"
						class="text-black/35 hover:text-red-600"
						onclick={() => remove(item.id)}><Trash2 class="size-4" /></button
					>
				</div>{/each}{#if todos.length === 0}<div
					class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
				>
					還沒有待辦事項。
				</div>{/if}
		</div>
	</section>
	<form class="grid h-fit gap-4 border border-black/10 bg-white p-5" onsubmit={add}>
		<h3 class="text-lg font-black">新增待辦</h3>
		<Input
			bind:value={title}
			placeholder="例如：確認住宿訂單"
			required
			class="rounded-none border-black/20 bg-[#fbfcf8]"
		/><Input
			type="date"
			bind:value={dueDate}
			class="rounded-none border-black/20 bg-[#fbfcf8]"
		/><Button
			type="submit"
			class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			><Plus class="size-4" /> 新增</Button
		>
	</form>
</main>
