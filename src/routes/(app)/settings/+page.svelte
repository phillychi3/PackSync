<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { ArrowLeft, UserRound } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { toast } from '$lib/stores/toast'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	// svelte-ignore state_referenced_locally
	let name = $state(data.user.name ?? '')
	// svelte-ignore state_referenced_locally
	let image = $state(data.user.image ?? '')
	let saving = $state(false)

	async function save(event: SubmitEvent) {
		event.preventDefault()
		if (!name.trim()) {
			toast.error('暱稱不能是空的')
			return
		}
		saving = true
		const res = await fetch('/api/me', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ name: name.trim(), image: image.trim() })
		})
		if (res.ok) {
			toast.success('個人資料已更新')
			await invalidateAll()
		} else {
			toast.error('更新失敗，請稍後再試')
		}
		saving = false
	}
</script>

<svelte:head>
	<title>個人設定 | PackSync</title>
</svelte:head>

<main class="min-h-screen bg-[#f4f5f2] text-[#151817]">
	<section class="mx-auto w-full max-w-2xl px-5 py-8 sm:px-8 lg:py-12">
		<a
			href={resolve('/trips')}
			class="inline-flex items-center gap-2 text-xs font-bold text-black/50 hover:text-black"
		>
			<ArrowLeft class="size-3.5" /> 返回旅程
		</a>
		<header class="mt-4 border-b border-black/15 pb-6">
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">PACKSYNC / 設定</p>
			<h1 class="mt-3 text-4xl font-black tracking-[-0.045em]">個人設定</h1>
			<p class="mt-3 text-black/55">設定你在旅程中顯示的暱稱與頭像。</p>
		</header>

		<form class="mt-8 grid gap-5 border border-black/10 bg-white p-6" onsubmit={save}>
			<div class="flex items-center gap-4">
				{#if image.trim()}
					<img
						src={image.trim()}
						alt="頭像預覽"
						class="size-16 shrink-0 border border-black/15 object-cover"
					/>
				{:else}
					<span
						class="grid size-16 shrink-0 place-items-center border border-black/15 bg-[#f4f5f2]"
					>
						<UserRound class="size-7 text-black/35" />
					</span>
				{/if}
				<div class="min-w-0">
					<p class="truncate font-bold">{data.user.email}</p>
					<p class="mt-1 text-xs text-black/45">Email 無法在這裡變更。</p>
				</div>
			</div>
			<label class="grid gap-2 text-sm font-bold"
				>暱稱<Input
					bind:value={name}
					required
					placeholder="旅伴看到的名字"
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/></label
			>
			<label class="grid gap-2 text-sm font-bold"
				>頭像網址<Input
					bind:value={image}
					type="url"
					placeholder="https://…（留空表示不使用頭像）"
					class="rounded-none border-black/20 bg-[#fbfcf8]"
				/></label
			>
			<Button
				type="submit"
				disabled={saving}
				class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
			>
				{saving ? '儲存中…' : '儲存變更'}
			</Button>
		</form>
	</section>
</main>
