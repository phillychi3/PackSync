<script lang="ts">
	import { onMount } from 'svelte'
	import {
		ArrowDownRight,
		ArrowRight,
		BellRing,
		Bot,
		CalendarDays,
		CheckCircle2,
		CircleDollarSign,
		ListChecks,
		MapPin,
		PackageCheck,
		Route,
		ShieldCheck,
		Sparkles
	} from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'

	let pageRoot: HTMLElement

	const features = [
		{
			id: '01',
			icon: CalendarDays,
			label: 'SMART ITINERARY',
			title: '不只排好，也知道怎麼走',
			text: '用時間軸、月曆與地圖查看安排，也能查詢行程間的交通方式。',
			accent: 'bg-[#d8ff36]'
		},
		{
			id: '02',
			icon: CircleDollarSign,
			label: 'SPLIT EXPENSES',
			title: '每一筆都算得剛剛好',
			text: '記錄多人付款，支援均分、比例與指定金額。',
			accent: 'bg-[#ffb86b]'
		},
		{
			id: '03',
			icon: PackageCheck,
			label: 'PACK TOGETHER',
			title: '少帶一件，大家都看得見',
			text: '共用打包清單，清楚查看物品與完成進度。',
			accent: 'bg-[#9ce5ff]'
		},
		{
			id: '04',
			icon: ShieldCheck,
			label: 'CRITICAL ITEMS',
			title: '重要的事，逐一確認',
			text: '把護照、門票等事項綁定行程，讓成員逐一確認。',
			accent: 'bg-[#f2a7ff]'
		},
		{
			id: '05',
			icon: ListChecks,
			label: 'SHARED TODOS',
			title: '出發前，把待辦一起清空',
			text: '集中管理出發前的工作與期限。',
			accent: 'bg-[#fff08a]'
		},
		{
			id: '06',
			icon: Bot,
			label: 'TRAVEL AI',
			title: '用對話查詢旅程資料',
			text: '查詢現有行程、待辦與費用，或提出行程修改建議。',
			accent: 'bg-[#d8ff36]'
		}
	]

	const tickerItems = [
		'行程規劃',
		'交通路線',
		'多人分帳',
		'共同打包',
		'待辦追蹤',
		'推播提醒',
		'AI 旅遊助理'
	]

	onMount(() => {
		let context: { revert: () => void } | undefined
		let cancelled = false

		void (async () => {
			const [{ gsap }, { ScrollTrigger }] = await Promise.all([
				import('gsap'),
				import('gsap/ScrollTrigger')
			])
			if (cancelled) return
			gsap.registerPlugin(ScrollTrigger)

			const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
			if (reduceMotion) return

			context = gsap.context(() => {
				const intro = gsap.timeline({ defaults: { ease: 'power3.out' } })
				intro
					.from('.js-nav', { y: -20, opacity: 0, duration: 0.6 })
					.from('.js-hero-line', { yPercent: 105, duration: 0.9, stagger: 0.12 }, '-=0.25')
					.from('.js-hero-copy', { y: 24, opacity: 0, duration: 0.7, stagger: 0.1 }, '-=0.45')
					.from('.js-product-card', { y: 50, rotate: 2, opacity: 0, duration: 0.9 }, '-=0.65')
					.from(
						'.js-float-card',
						{ scale: 0.85, opacity: 0, duration: 0.55, stagger: 0.12 },
						'-=0.45'
					)

				gsap.to('.js-product-card', {
					y: -18,
					ease: 'none',
					scrollTrigger: { trigger: '.js-hero', start: 'top top', end: 'bottom top', scrub: 1 }
				})

				gsap.to('.js-ticker', { xPercent: -50, duration: 24, repeat: -1, ease: 'none' })

				gsap.utils.toArray<HTMLElement>('.js-reveal').forEach((element) => {
					gsap.from(element, {
						y: 45,
						opacity: 0,
						duration: 0.85,
						ease: 'power3.out',
						scrollTrigger: { trigger: element, start: 'top 84%', once: true }
					})
				})

				gsap.from('.js-feature-card', {
					y: 55,
					opacity: 0,
					duration: 0.75,
					stagger: 0.09,
					ease: 'power3.out',
					scrollTrigger: { trigger: '.js-feature-grid', start: 'top 78%', once: true }
				})

				gsap.fromTo(
					'.js-route-line',
					{ strokeDasharray: 900, strokeDashoffset: 900 },
					{
						strokeDashoffset: 0,
						duration: 2,
						ease: 'power2.inOut',
						scrollTrigger: { trigger: '.js-flow', start: 'top 72%', once: true }
					}
				)

				gsap.from('.js-flow-node', {
					scale: 0,
					duration: 0.45,
					stagger: 0.25,
					ease: 'back.out(1.8)',
					scrollTrigger: { trigger: '.js-flow', start: 'top 72%', once: true }
				})
			}, pageRoot)
		})()

		return () => {
			cancelled = true
			context?.revert()
		}
	})
</script>

<svelte:head>
	<title>PackSync｜一起出發，不必一起混亂</title>
	<meta
		name="description"
		content="PackSync 把多人旅遊的行程、交通、分帳、打包、待辦、提醒與 AI 助理放進同一個地方。"
	/>
</svelte:head>

<div
	bind:this={pageRoot}
	class="min-h-screen overflow-hidden bg-[#f3f4ef] text-[#171a19] selection:bg-[#d8ff36] selection:text-black"
>
	<header
		class="js-nav fixed inset-x-0 top-0 z-50 border-b border-black/10 bg-[#f3f4ef]/85 backdrop-blur-xl"
	>
		<div
			class="mx-auto flex h-18 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12"
		>
			<a href="/" class="flex items-center gap-3" aria-label="PackSync 首頁">
				<span class="grid size-9 place-items-center bg-[#171a19] text-xs font-black text-[#d8ff36]"
					>PS</span
				>
				<span class="text-lg font-black tracking-[-0.05em]">PACKSYNC</span>
			</a>
			<div class="flex items-center gap-2">
				<Button href="/login" variant="ghost" class="hidden rounded-none px-4 font-bold sm:flex"
					>登入</Button
				>
				<Button
					href="/register"
					class="group rounded-none bg-[#171a19] px-4 font-bold text-white hover:bg-black"
				>
					開始 <ArrowRight class="size-4 transition-transform group-hover:translate-x-1" />
				</Button>
			</div>
		</div>
	</header>

	<main>
		<section class="js-hero relative min-h-[760px] border-b border-black/15 pt-18 lg:min-h-screen">
			<div
				class="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(#171a19_1px,transparent_1px),linear-gradient(90deg,#171a19_1px,transparent_1px)] [background-size:64px_64px]"
			></div>
			<div
				class="relative mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-[1440px] lg:grid-cols-[1.04fr_0.96fr]"
			>
				<div
					class="flex flex-col justify-center border-x border-black/10 px-5 py-20 sm:px-10 lg:px-14 lg:py-28"
				>
					<div
						class="js-hero-copy mb-9 flex items-center gap-3 font-mono text-[10px] font-bold tracking-[0.18em] text-black/50"
					>
						<span class="relative flex size-2"
							><span class="absolute inline-flex size-full animate-ping bg-[#799b00] opacity-50"
							></span><span class="relative inline-flex size-2 bg-[#799b00]"></span></span
						>
						ALL-IN-ONE TRAVEL WORKSPACE <span class="h-px w-12 bg-black/20"></span> 2026
					</div>
					<h1
						class="text-[clamp(3.6rem,7.5vw,7.7rem)] font-black leading-[0.91] tracking-[-0.078em] mt-0.5"
					>
						<span class="block"><span class="js-hero-line block">一起出發，</span></span>
						<span class="block overflow-hidden"
							><span class="js-hero-line block text-black/25">不必一起</span></span
						>
						<span class="block overflow-hidden"><span class="js-hero-line block">混亂。</span></span
						>
					</h1>
					<div class="js-hero-copy mt-10 flex flex-col gap-3 sm:flex-row">
						<Button
							href="/register"
							class="group min-h-14 justify-between rounded-none bg-[#d8ff36] px-6 font-black text-black ring-1 ring-black hover:bg-[#c9ef2d]"
						>
							建立第一趟旅程 <ArrowRight
								class="size-5 transition-transform group-hover:translate-x-1"
							/>
						</Button>
					</div>
				</div>

				<div
					class="relative hidden min-h-[680px] overflow-hidden border-r border-black/10 bg-[#1c201f] lg:block"
				>
					<div
						class="absolute inset-0 opacity-15 [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:18px_18px]"
					></div>
					<div
						class="absolute top-8 right-8 left-8 flex justify-between font-mono text-[10px] tracking-[0.14em] text-white/35"
					>
						<span>LIVE TRIP / TOKYO 05</span><span>6 MEMBERS</span>
					</div>

					<div
						class="js-product-card absolute top-[15%] right-[10%] left-[8%] border border-white/15 bg-[#f5f6f1] shadow-[0_30px_80px_rgba(0,0,0,.45)]"
					>
						<div class="flex items-center justify-between border-b border-black/10 px-5 py-4">
							<div>
								<p class="font-mono text-[9px] tracking-widest text-black/40">TODAY / MAY 18</p>
								<p class="mt-1 text-sm font-black">東京散步日</p>
							</div>
							<span class="bg-[#d8ff36] px-2 py-1 font-mono text-[9px] font-black">DAY 02</span>
						</div>
						<div class="grid grid-cols-[72px_1fr] px-5 py-6">
							<div class="font-mono text-xs text-black/40">
								<p>09:30</p>
								<p class="mt-[74px]">11:10</p>
								<p class="mt-[74px]">14:20</p>
							</div>
							<div class="relative border-l border-black/15 pl-6">
								<div
									class="absolute top-1 -left-1.5 size-3 rounded-full border-2 border-[#f5f6f1] bg-black"
								></div>
								<div>
									<p class="font-black">築地市場早餐</p>
									<p class="mt-1 text-xs text-black/40">中央區</p>
								</div>
								<div
									class="my-6 flex items-center gap-2 border-y border-black/10 py-3 text-[10px] font-bold text-black/50"
								>
									<Route class="size-3.5" /> 地鐵 24 分鐘 · ¥180
								</div>
								<div class="relative">
									<div
										class="absolute top-1 -left-[31px] size-3 rounded-full border-2 border-[#f5f6f1] bg-[#799b00]"
									></div>
									<p class="font-black">淺草寺與仲見世</p>
									<p class="mt-1 text-xs text-black/40">台東區 · 下一站</p>
								</div>
								<div
									class="my-6 flex items-center gap-2 border-y border-black/10 py-3 text-[10px] font-bold text-black/50"
								>
									<Route class="size-3.5" /> 步行 12 分鐘 · 850m
								</div>
								<div class="relative">
									<div
										class="absolute top-1 -left-[31px] size-3 rounded-full border-2 border-[#f5f6f1] bg-black/20"
									></div>
									<p class="font-black">上野公園</p>
									<p class="mt-1 text-xs text-black/40">台東區 · 2 個提醒</p>
								</div>
							</div>
						</div>
					</div>

					<div
						class="js-float-card absolute top-[12%] right-[3%] grid size-18 place-items-center bg-[#d8ff36] shadow-2xl"
					>
						<MapPin class="size-7" />
					</div>
					<div
						class="js-float-card absolute right-[3%] bottom-[12%] w-48 border border-white/15 bg-[#2b302e] p-4 text-white shadow-2xl"
					>
						<div class="flex items-center justify-between">
							<p class="font-mono text-[9px] text-white/40">PACKING</p>
							<PackageCheck class="size-4 text-[#d8ff36]" />
						</div>
						<p class="mt-3 text-2xl font-black">18 / 21</p>
						<div class="mt-3 h-1 bg-white/10"><div class="h-full w-[86%] bg-[#d8ff36]"></div></div>
					</div>
					<div
						class="js-float-card absolute bottom-[7%] left-[3%] border border-black/10 bg-white p-4 shadow-2xl"
					>
						<p class="font-mono text-[9px] text-black/40">GROUP EXPENSES</p>
						<p class="mt-2 text-xl font-black">NT$ 12,840</p>
						<p class="mt-1 text-[10px] text-[#668500]">✓ 已記錄 8 筆費用</p>
					</div>
				</div>
			</div>
		</section>

		<div class="overflow-hidden border-b border-black bg-[#d8ff36] py-4">
			<div class="js-ticker flex w-max whitespace-nowrap">
				{#each [...tickerItems, ...tickerItems] as item}
					<span
						class="flex items-center px-7 text-sm font-black tracking-tight sm:px-10 sm:text-base"
						><span class="mr-7 size-2 bg-black sm:mr-10"></span>{item}</span
					>
				{/each}
			</div>
		</div>

		<section
			id="features"
			class="mx-auto max-w-[1440px] border-x border-black/10 px-5 py-24 sm:px-10 lg:px-14 lg:py-32"
		>
			<div class="js-reveal mb-14 grid gap-8 lg:grid-cols-[1fr_0.72fr] lg:items-end">
				<div>
					<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/40">
						01 / EVERYTHING IN SYNC
					</p>
					<h2
						class="mt-4 max-w-3xl text-5xl font-black leading-[0.94] tracking-[-0.06em] sm:text-7xl"
					>
						旅行很複雜。<br /><span class="text-black/25">工具不需要。</span>
					</h2>
				</div>
				<p class="max-w-xl text-lg leading-8 text-black/55">
					行程、清單與費用集中在同一趟旅程，不必來回找資料。
				</p>
			</div>

			<div
				class="js-feature-grid grid border-t border-l border-black/20 md:grid-cols-2 xl:grid-cols-3"
			>
				{#each features as feature}
					{@const FeatureIcon = feature.icon}
					<article
						class="js-feature-card group relative min-h-[330px] overflow-hidden border-r border-b border-black/20 bg-[#f8f9f5] p-7 transition-colors duration-300 hover:bg-white sm:p-8"
					>
						<div class="flex items-start justify-between">
							<span class="font-mono text-[10px] tracking-[0.15em] text-black/40"
								>{feature.id} / {feature.label}</span
							><span class={`grid size-11 place-items-center ${feature.accent}`}
								><FeatureIcon
									class="size-5 transition-transform duration-300 group-hover:rotate-[-8deg] group-hover:scale-110"
								/></span
							>
						</div>
						<div class="absolute right-8 bottom-8 left-8">
							<h3 class="max-w-sm text-2xl font-black leading-tight tracking-[-0.035em]">
								{feature.title}
							</h3>
							<p class="mt-4 max-w-md text-sm leading-6 text-black/52">{feature.text}</p>
						</div>
					</article>
				{/each}
			</div>
		</section>

		<section id="how-it-works" class="border-y border-black/15 bg-[#1b1f1e] text-white">
			<div class="mx-auto grid max-w-[1440px] lg:grid-cols-[0.78fr_1.22fr]">
				<div class="js-reveal border-x border-white/10 px-5 py-20 sm:px-10 lg:px-14 lg:py-28">
					<p class="font-mono text-xs font-bold tracking-[0.18em] text-white/35">
						02 / ONE SHARED CONTEXT
					</p>
					<h2 class="mt-4 text-5xl font-black leading-[0.94] tracking-[-0.06em] sm:text-7xl">
						資料放一起，<br /><span class="text-white/25">找起來更快。</span>
					</h2>
					<p class="mt-8 max-w-md leading-7 text-white/50">
						行程、待辦、重要事項與費用。
					</p>
					<div class="mt-12 flex items-center gap-3 text-sm font-bold text-[#d8ff36]">
						<Sparkles class="size-4" /> 需要時，再打開查看
					</div>
				</div>

				<div
					class="js-flow relative min-h-[560px] overflow-hidden border-r border-white/10 px-5 py-16 sm:px-10 lg:min-h-[680px] lg:p-14"
				>
					<div
						class="absolute inset-0 opacity-10 [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:48px_48px]"
					></div>
					<svg
						class="absolute inset-0 h-full w-full"
						viewBox="0 0 760 680"
						fill="none"
						aria-hidden="true"
						><path
							class="js-route-line"
							d="M98 115C250 115 190 270 377 278C560 286 504 455 666 455M377 278C365 425 238 430 238 570"
							stroke="#d8ff36"
							stroke-width="2"
						/></svg
					>
					<div
						class="js-flow-node absolute top-[10%] left-[7%] w-52 border border-white/20 bg-[#2a2f2d] p-5 shadow-2xl"
					>
						<div class="flex items-center gap-2 text-xs font-bold text-[#d8ff36]">
							<CalendarDays class="size-4" /> 行程有更新
						</div>
						<p class="mt-3 text-xl font-black">淺草寺改到 11:10</p>
						<p class="mt-2 text-xs text-white/35">剛剛 · YU</p>
					</div>
					<div
						class="js-flow-node absolute top-[32%] left-[38%] grid size-28 place-items-center rounded-full border border-[#d8ff36]/50 bg-[#d8ff36] text-black shadow-[0_0_60px_rgba(216,255,54,.2)]"
					>
						<div class="text-center">
							<span class="text-xl font-black">SYNC</span>
						</div>
					</div>
					<div
						class="js-flow-node absolute right-[5%] bottom-[25%] w-48 border border-white/20 bg-[#f4f5f0] p-5 text-black shadow-2xl"
					>
						<BellRing class="size-5" />
						<p class="mt-4 text-sm font-black">通知中心</p>
						<p class="mt-1 text-[10px] text-black/40">查看近期提醒</p>
					</div>
					<div
						class="js-flow-node absolute bottom-[6%] left-[16%] w-48 border border-white/20 bg-[#2a2f2d] p-5 shadow-2xl"
					>
						<ListChecks class="size-5 text-[#d8ff36]" />
						<p class="mt-4 text-sm font-black">旅程資料</p>
						<p class="mt-1 text-[10px] text-white/35">行程、待辦與分帳</p>
					</div>
				</div>
			</div>
		</section>

		<section class="bg-[#d8ff36] px-5 py-24 sm:px-10 lg:py-32">
			<div class="js-reveal mx-auto max-w-6xl text-center">
				<div class="mx-auto flex w-fit -space-x-2">
					{#each ['YU', 'AN', 'LI', 'CH'] as member, index}<span
							class="grid size-11 place-items-center rounded-full border-2 border-[#d8ff36] bg-[#171a19] text-[10px] font-black text-white"
							style={`opacity: ${1 - index * 0.12}`}>{member}</span
						>{/each}
				</div>
				<p class="mt-7 font-mono text-xs font-bold tracking-[0.18em]">YOUR NEXT TRIP STARTS HERE</p>
				<h2
					class="mt-4 text-[clamp(3.5rem,9vw,8.5rem)] font-black leading-[0.95] tracking-[-0.075em]"
				>
					下一趟，<br />大家一起來。
				</h2>
				<p class="mx-auto mt-8 max-w-xl text-lg text-black/60">
					建立旅程，邀請旅伴，把資料放在一起。
				</p>
				<Button
					href="/register"
					class="group mx-auto mt-10 min-h-14 rounded-none bg-[#171a19] px-7 font-black text-white hover:bg-black"
					>建立旅程 <ArrowRight
						class="size-5 transition-transform group-hover:translate-x-1"
					/></Button
				>
			</div>
		</section>
	</main>

	<footer class="bg-[#171a19] px-5 py-8 text-white sm:px-10">
		<div
			class="mx-auto flex max-w-[1440px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<div class="flex items-center gap-3">
					<span
						class="grid size-8 place-items-center bg-[#d8ff36] text-[10px] font-black text-black"
						>PS</span
					><span class="font-black tracking-[-0.04em]">PACKSYNC</span>
				</div>
				<p class="mt-3 text-xs text-white/35">KEEP EVERYONE IN SYNC.</p>
			</div>
			<div class="flex items-center gap-6 text-xs font-bold text-white/45">
				<a class="hover:text-white" href="/login">登入</a><a
					class="hover:text-white"
					href="/register">註冊</a
				><span class="font-mono">© 2026</span>
			</div>
		</div>
	</footer>
</div>
