<script lang="ts">
	import { Copy, Mail, UserPlus } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import type { PageData } from './$types'
	type Member = { id: string; userId: string; name: string | null; email: string; role: string }
	let { data }: { data: PageData } = $props()
	let members = $state<Member[]>([])
	let inviteUrl = $state('')
	let copied = $state(false)
	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/members`)
		if (response.ok) members = await response.json()
	}
	async function createInvite() {
		const response = await fetch(`/api/trips/${data.trip.id}/invite`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ expiresInHours: 72 })
		})
		if (response.ok) inviteUrl = `${location.origin}/invite/${(await response.json()).token}`
	}
	async function copy() {
		await navigator.clipboard.writeText(inviteUrl)
		copied = true
		setTimeout(() => (copied = false), 1800)
	}
	onMount(load)
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<div
		class="flex flex-col gap-5 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">06 / 成員</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">同行夥伴</h2>
			<p class="mt-3 text-black/55">邀請一起旅行的人，讓所有人看到同一份計畫。</p>
		</div>
		<Button
			type="button"
			class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			onclick={createInvite}><UserPlus class="size-4" /> 建立邀請連結</Button
		>
	</div>
	{#if inviteUrl}<div
			class="mt-6 flex flex-col gap-3 border border-[#b8e600] bg-[#efffc1] p-4 sm:flex-row sm:items-center"
		>
			<Mail class="size-5 shrink-0" /><span class="min-w-0 flex-1 truncate font-mono text-sm"
				>{inviteUrl}</span
			><Button
				type="button"
				variant="outline"
				class="h-9 rounded-none border-black/20 bg-white font-bold"
				onclick={copy}><Copy class="size-4" /> {copied ? '已複製' : '複製連結'}</Button
			>
		</div>{/if}
	<section class="mt-8 grid gap-2">
		{#each members as member (member.id)}<div
				class="flex items-center gap-4 border border-black/10 bg-white p-4"
			>
				<span class="grid size-10 shrink-0 place-items-center bg-[#eef0eb] font-bold"
					>{(member.name ?? member.email).slice(0, 1).toUpperCase()}</span
				>
				<div class="min-w-0 flex-1">
					<p class="truncate font-bold">{member.name || '未設定名稱'}</p>
					<p class="truncate text-sm text-black/45">{member.email}</p>
				</div>
				<span class="bg-[#d8ff36] px-2 py-1 font-mono text-[10px] font-bold uppercase"
					>{member.role}</span
				>
			</div>{/each}{#if members.length === 0}<div
				class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50"
			>
				還沒有成員。
			</div>{/if}
	</section>
</main>
