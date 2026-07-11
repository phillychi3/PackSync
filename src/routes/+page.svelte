<script lang="ts">
	import {
		ArrowRight,
		Bot,
		Check,
		CircleDollarSign,
		Map,
		PackageCheck,
		Radio,
		Users
	} from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Card, CardContent } from '$lib/components/ui/card'

	const features = [
		{
			id: '01',
			icon: Map,
			label: 'ITINERARY',
			title: '行程，一眼掌握',
			text: '時間軸與地圖雙模式，讓每位旅伴都知道下一站在哪裡。'
		},
		{
			id: '02',
			icon: CircleDollarSign,
			label: 'EXPENSES',
			title: '分帳，不再混亂',
			text: '共同記帳、自動拆分，旅程結束時用最少轉帳完成結算。'
		},
		{
			id: '03',
			icon: PackageCheck,
			label: 'PACKING',
			title: '行李，不再漏帶',
			text: '指派、追蹤與重要物品確認，出發前讓所有人都放心。'
		},
		{
			id: '04',
			icon: Bot,
			label: 'AI AGENT',
			title: '旅程，隨問即答',
			text: '從下一個行程到今日預算，AI 助理使用旅程資料快速回答。'
		}
	]
</script>

<svelte:head>
	<title>PackSync — 讓每段旅程保持同步</title>
	<meta name="description" content="PackSync 是為多人旅行打造的行程、分帳、行李與 AI 協作工具。" />
</svelte:head>

<div
	class="min-h-screen overflow-hidden bg-[#f4f5f2] text-[#151817] selection:bg-[#d8ff36] selection:text-black"
>
	<header class="relative z-20 border-b border-black/15 bg-[#f4f5f2]/90 backdrop-blur">
		<div class="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8">
			<a href="/" class="flex items-center gap-3" aria-label="PackSync 首頁">
				<span class="grid size-8 place-items-center bg-[#171a19] text-xs font-black text-[#d8ff36]"
					>PS</span
				>
				<span class="text-lg font-black tracking-[-0.04em]">PACKSYNC</span>
			</a>
			<nav class="flex items-center gap-2" aria-label="主要導覽">
				<Button href="/login" variant="ghost" class="hidden rounded-none px-4 font-semibold sm:flex"
					>登入</Button
				>
				<Button
					href="/register"
					class="group h-10 rounded-none bg-[#171a19] px-4 font-bold text-white hover:bg-black"
				>
					免費開始 <ArrowRight class="size-4 transition group-hover:translate-x-1" />
				</Button>
			</nav>
		</div>
	</header>

	<main>
		<section
			class="relative mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-7xl items-center border-x border-black/10 lg:grid-cols-[1.08fr_0.92fr]"
		>
			<div class="relative z-10 px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
				<div
					class="mb-8 flex items-center gap-3 font-mono text-[11px] font-bold tracking-[0.14em] text-black/55"
				>
					<span class="size-2 bg-[#8fb400]"></span> SYNC / ONLINE
					<span class="h-px w-12 bg-black/20"></span> TRAVEL OS / 2026
				</div>
				<p class="mb-3 font-mono text-xs font-bold tracking-[0.2em] text-black/50">
					01 / TRAVEL TOGETHER
				</p>
				<h1
					class="max-w-3xl text-[clamp(3.4rem,8vw,7.5rem)] font-black leading-[0.87] tracking-[-0.075em]"
				>
					一起出發<br /><span class="text-black/28">保持同步。</span>
				</h1>
				<p class="mt-8 max-w-xl text-lg leading-8 text-black/60 sm:text-xl">
					把行程、分帳、行李與旅程問題放進同一個地方。少一點群組訊息，多一點真正的旅行。
				</p>
				<div class="mt-10 flex flex-col gap-3 sm:flex-row">
					<Button
						href="/register"
						class="group flex min-h-13 items-center justify-between gap-8 bg-[#d8ff36] px-6 py-3 font-bold text-black ring-1 ring-black transition hover:bg-[#c8ef28]"
					>
						建立第一趟旅程 <ArrowRight class="size-5 transition group-hover:translate-x-1" />
					</Button>
					<Button
						href="#features"
						variant="outline"
						class="flex min-h-13 items-center justify-center border border-black/25 px-6 py-3 font-bold transition hover:bg-white"
						>探索功能</Button
					>
				</div>
				<div
					class="mt-14 flex flex-wrap gap-x-8 gap-y-3 border-t border-black/15 pt-5 font-mono text-[10px] tracking-[0.12em] text-black/45"
				>
					<span>PWA / OFFLINE READY</span><span>MULTI-USER / LIVE</span><span
						>AI / CONTEXT AWARE</span
					>
				</div>
			</div>

			<div
				class="relative hidden h-full min-h-[650px] border-l border-black/10 bg-[#202423] lg:block"
			>
				<div
					class="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:48px_48px]"
				></div>
				<div
					class="absolute top-8 right-8 left-8 flex justify-between font-mono text-[10px] tracking-widest text-white/40"
				>
					<span>TRIP / TPE-NRT-042</span><span>DAY 02 / 05</span>
				</div>
				<div
					class="absolute top-[18%] right-[10%] left-[10%] border border-white/15 bg-[#292e2c] p-5 text-white shadow-2xl"
				>
					<div class="mb-5 flex items-center justify-between">
						<span class="font-mono text-[10px] text-white/45">NEXT ACTIVITY / 03</span><span
							class="bg-[#d8ff36] px-2 py-1 font-mono text-[9px] font-bold text-black"
							>UPCOMING</span
						>
					</div>
					<p class="font-mono text-sm text-[#d8ff36]">14:20 — 16:00</p>
					<h2 class="mt-2 text-2xl font-bold">淺草寺與仲見世通</h2>
					<p class="mt-1 text-sm text-white/45">TOKYO / TAITO · 步行 8 分鐘</p>
					<div class="mt-6 flex -space-x-2">
						<span
							class="grid size-8 place-items-center rounded-full border-2 border-[#292e2c] bg-[#66706d] text-xs"
							>YU</span
						><span
							class="grid size-8 place-items-center rounded-full border-2 border-[#292e2c] bg-[#8a7965] text-xs"
							>AN</span
						><span
							class="grid size-8 place-items-center rounded-full border-2 border-[#292e2c] bg-[#596c7c] text-xs"
							>LI</span
						>
					</div>
				</div>
				<div
					class="absolute right-[6%] bottom-[20%] left-[17%] bg-[#e9ebe5] p-5 text-black shadow-2xl"
				>
					<div class="mb-4 flex items-center justify-between font-mono text-[10px] text-black/45">
						<span>GROUP STATUS</span><Radio class="size-4 text-[#779a00]" />
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="border-l-2 border-black pl-3">
							<p class="text-2xl font-black">84%</p>
							<p class="text-xs text-black/50">行李已完成</p>
						</div>
						<div class="border-l-2 border-[#d8ff36] pl-3">
							<p class="text-2xl font-black">NT$ 860</p>
							<p class="text-xs text-black/50">你的待付款</p>
						</div>
					</div>
				</div>
				<div
					class="absolute bottom-8 left-8 flex items-center gap-2 font-mono text-[10px] text-white/40"
				>
					<Users class="size-4" /> MEMBERS / 06 · UPDATED / NOW
				</div>
			</div>
		</section>

		<section
			id="features"
			class="mx-auto max-w-7xl border-x border-t border-black/10 bg-[#eef0eb] px-5 py-20 sm:px-10 lg:px-14 lg:py-28"
		>
			<div class="mb-12 grid gap-5 lg:grid-cols-2">
				<div>
					<p class="font-mono text-xs font-bold tracking-widest text-black/45">
						02 / SYSTEM MODULES
					</p>
					<h2 class="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-6xl">
						旅程需要的，<br />都在這裡。
					</h2>
				</div>
				<p class="max-w-lg self-end text-lg leading-8 text-black/55">
					為多人旅行設計的共享工作台，讓變更、責任與進度清楚可見。
				</p>
			</div>
			<div class="grid border-t border-l border-black/20 md:grid-cols-2">
				{#each features as feature}
					{@const FeatureIcon = feature.icon}
					<Card
						class="group rounded-none border-0 border-r border-b border-black/20 bg-[#f7f8f5] py-0 shadow-none ring-0 transition hover:bg-white"
					>
						<CardContent class="p-6 sm:p-8">
							<div class="mb-14 flex items-start justify-between">
								<span class="font-mono text-xs text-black/40">{feature.id} / {feature.label}</span
								><FeatureIcon class="size-6 transition group-hover:text-[#799800]" />
							</div>
							<h3 class="text-2xl font-bold tracking-tight">{feature.title}</h3>
							<p class="mt-3 max-w-md leading-7 text-black/55">{feature.text}</p>
						</CardContent>
					</Card>
				{/each}
			</div>
		</section>

		<section class="bg-[#171a19] px-5 py-20 text-white sm:px-10 lg:py-28">
			<div class="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center">
				<div>
					<p class="font-mono text-xs tracking-widest text-white/40">03 / READY TO DEPART</p>
					<h2 class="mt-4 text-5xl font-black tracking-[-0.055em] sm:text-7xl">
						下一趟旅程，<br />從同步開始。
					</h2>
				</div>
				<div class="lg:pl-16">
					<div class="mb-8 space-y-3 text-sm text-white/65">
						<p class="flex items-center gap-3">
							<Check class="size-4 text-[#d8ff36]" /> 免費建立帳號
						</p>
						<p class="flex items-center gap-3">
							<Check class="size-4 text-[#d8ff36]" /> 邀請旅伴共同規劃
						</p>
						<p class="flex items-center gap-3">
							<Check class="size-4 text-[#d8ff36]" /> 手機與桌面皆可使用
						</p>
					</div>
					<Button
						href="/register"
						class="group flex max-w-sm items-center justify-between bg-[#d8ff36] px-6 py-4 font-bold text-black transition hover:bg-white"
						>免費建立帳號 <ArrowRight class="size-5 transition group-hover:translate-x-1" /></Button
					>
				</div>
			</div>
		</section>
	</main>
	<footer class="border-t border-white/10 bg-[#171a19] px-5 py-6 text-white/35">
		<div
			class="mx-auto flex max-w-7xl items-center justify-between font-mono text-[10px] tracking-widest"
		>
			<span>PACKSYNC © 2026</span><span>KEEP EVERYONE IN SYNC</span>
		</div>
	</footer>
</div>
