<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { page } from '$app/state'
	import { ArrowLeft, Home, RefreshCw } from '@lucide/svelte'

	const message = $derived(
		page.error?.message || (page.status === 404 ? '找不到你要前往的頁面。' : '頁面發生了一點問題。')
	)
</script>

<svelte:head>
	<title>{page.status} | 發生錯誤 | PackSync</title>
</svelte:head>

<main class="grid min-h-screen place-items-center bg-[#f4f5f2] px-5 text-[#151817]">
	<section class="w-full max-w-2xl border border-black/10 bg-white p-6 sm:p-10">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">PACKSYNC / 錯誤</p>
		<h1 class="mt-4 text-6xl font-black tracking-[-0.06em] sm:text-8xl">{page.status}</h1>
		<p class="mt-5 text-xl font-bold">{message}</p>
		<p class="mt-3 max-w-lg leading-7 text-black/55">
			目前的頁面無法完成載入。你可以回到旅程列表，或重新整理後再試一次。
		</p>

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			<Button
				href="/trips"
				class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
			>
				<Home class="size-4" />
				旅程列表
			</Button>
			<Button href="/" variant="outline" class="h-11 rounded-none border-black/20 px-5 font-bold">
				<ArrowLeft class="size-4" />
				首頁
			</Button>
			<Button
				type="button"
				variant="ghost"
				class="h-11 rounded-none px-5 font-bold"
				onclick={() => location.reload()}
			>
				<RefreshCw class="size-4" />
				重新整理
			</Button>
		</div>
	</section>
</main>
