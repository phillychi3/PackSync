<script lang="ts">
	import { Check, Plus, Trash2 } from '@lucide/svelte'
	import ActionMenu from '$lib/components/action-menu.svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { toast } from '$lib/stores/toast'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'
	type Todo = { id: string; title: string; dueDate: string | null; isCompleted: boolean }
	let { data }: { data: PageData } = $props()
	const readonly = $derived(data.trip.status === 'completed')
	const tidy = $derived(data.trip.status === 'ongoing')
	let todos = $state<Todo[]>([])
	let title = $state('')
	let dueDate = $state('')
	let saving = $state(false)

	const today = new Date().toISOString().slice(0, 10)
	let groups = $derived.by(() => {
		const overdue: Todo[] = []
		const dueToday: Todo[] = []
		const upcoming: Todo[] = []
		const noDate: Todo[] = []
		const completed: Todo[] = []
		for (const item of todos) {
			if (item.isCompleted) completed.push(item)
			else if (!item.dueDate) noDate.push(item)
			else if (item.dueDate < today) overdue.push(item)
			else if (item.dueDate === today) dueToday.push(item)
			else upcoming.push(item)
		}
		const byDue = (a: Todo, b: Todo) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
		overdue.sort(byDue)
		upcoming.sort(byDue)
		return [
			{ label: '已逾期', tone: 'text-red-600', items: overdue },
			{ label: '今天', tone: 'text-[#779a00]', items: dueToday },
			{ label: '接下來', tone: 'text-black/60', items: upcoming },
			{ label: '沒有期限', tone: 'text-black/40', items: noDate },
			{ label: '已完成', tone: 'text-black/35', items: completed }
		].filter((group) => group.items.length > 0)
	})

	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/todos`)
		if (response.ok) todos = await response.json()
	}
	async function add(event: SubmitEvent) {
		event.preventDefault()
		if (!title.trim() || saving) return
		saving = true
		const response = await fetch(`/api/trips/${data.trip.id}/todos`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ title, dueDate: dueDate || null })
		})
		if (response.ok) {
			todos = [...todos, await response.json()]
			title = ''
			dueDate = ''
			toast.success('已新增待辦')
		} else {
			toast.error('新增待辦失敗，請稍後再試')
		}
		saving = false
	}
	async function toggle(item: Todo) {
		const response = await fetch(`/api/trips/${data.trip.id}/todos/${item.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ isCompleted: !item.isCompleted })
		})
		if (response.ok) item.isCompleted = !item.isCompleted
		else toast.error('更新失敗，請稍後再試')
	}
	async function remove(id: string) {
		const target = todos.find((item) => item.id === id)
		if (!target) return
		const res = await fetch(`/api/trips/${data.trip.id}/todos/${id}`, { method: 'DELETE' })
		if (!res.ok) {
			toast.error('刪除失敗，請稍後再試')
			return
		}
		todos = todos.filter((item) => item.id !== id)
		toast.success('已刪除待辦', {
			action: {
				label: '復原',
				onClick: async () => {
					const restore = await fetch(`/api/trips/${data.trip.id}/todos`, {
						method: 'POST',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ title: target.title, dueDate: target.dueDate })
					})
					if (restore.ok) {
						todos = [...todos, await restore.json()]
						toast.success('已復原待辦')
					} else {
						toast.error('復原失敗')
					}
				}
			}
		})
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
		<div class="mt-6 grid gap-5">
			{#each groups as group (group.label)}
				<div>
					<p class="mb-2 font-mono text-xs font-bold tracking-widest {group.tone}">
						{group.label} · {group.items.length}
					</p>
					<div class="grid gap-2">
						{#each group.items as item (item.id)}
							<div class="flex items-center gap-3 border border-black/10 bg-white p-4">
								<button
									type="button"
									title="標記完成"
									disabled={readonly}
									class={`grid size-6 shrink-0 place-items-center border disabled:cursor-not-allowed ${item.isCompleted ? 'border-[#779a00] bg-[#d8ff36]' : 'border-black/25'}`}
									onclick={() => toggle(item)}
									>{#if item.isCompleted}<Check class="size-4" />{/if}</button
								>
								<div class="min-w-0 flex-1">
									<p class={`font-bold ${item.isCompleted ? 'text-black/35 line-through' : ''}`}>
										{item.title}
									</p>
									{#if item.dueDate}<p
											class="mt-1 text-xs {!item.isCompleted && item.dueDate < today
												? 'font-bold text-red-600'
												: 'text-black/45'}"
										>
											期限：{item.dueDate}
										</p>{/if}
								</div>
								{#if !readonly}
									{#if tidy}
										<ActionMenu
											actions={[
												{
													label: '刪除',
													icon: Trash2,
													danger: true,
													onClick: () => remove(item.id)
												}
											]}
										/>
									{:else}
										<button
											type="button"
											title="刪除待辦"
											class="text-black/35 hover:text-red-600"
											onclick={() => remove(item.id)}><Trash2 class="size-4" /></button
										>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/each}
			{#if todos.length === 0}<div
					class="border border-dashed border-black/20 bg-white p-8 text-center text-black/50"
				>
					還沒有待辦事項。
				</div>{/if}
		</div>
	</section>
	{#if readonly}
		<div class="h-fit border border-black/10 bg-white p-5 text-sm leading-6 text-black/50">
			這趟旅程已完成，待辦保留為紀錄，無法再修改。
		</div>
	{:else}
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
				disabled={saving}
				class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
				><Plus class="size-4" /> {saving ? '新增中…' : '新增'}</Button
			>
		</form>
	{/if}
</main>
