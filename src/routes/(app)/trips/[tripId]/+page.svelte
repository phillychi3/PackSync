<script lang="ts">
	import { resolve } from '$app/paths'
	import {
		CalendarDays,
		CheckSquare,
		CircleDollarSign,
		ListChecks,
		MapPin,
		Plus,
		Users
	} from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Card, CardContent } from '$lib/components/ui/card'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	const route = resolve as unknown as (path: string) => string
	const base = $derived(`/trips/${data.trip.id}`)
	const cards = $derived([
		{
			href: `${base}/itinerary`,
			label: '行程',
			value: data.itinerary.length,
			icon: CalendarDays,
			text: '安排每日景點與活動'
		},
		{
			href: `${base}/packing`,
			label: '行李',
			value: data.packingCount,
			icon: CheckSquare,
			text: '整理共同攜帶物品'
		},
		{
			href: `${base}/expenses`,
			label: '費用',
			value: data.billCount,
			icon: CircleDollarSign,
			text: '記錄並分攤旅費'
		},
		{
			href: `${base}/todos`,
			label: '待辦',
			value: data.todoCount,
			icon: ListChecks,
			text: '追蹤出發前任務'
		},
		{
			href: `${base}/members`,
			label: '成員',
			value: data.memberCount,
			icon: Users,
			text: '管理同行夥伴'
		},
		{
			href: `${base}/critical`,
			label: '重要事項',
			value: data.criticalCount,
			icon: CheckSquare,
			text: '確認不能遺漏的事項'
		}
	])
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<section class="grid gap-8 border-b border-black/15 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
		<div>
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">PACKSYNC / 旅程總覽</p>
			<h2 class="mt-3 max-w-3xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">
				準備好一起出發。
			</h2>
			<p class="mt-4 max-w-2xl text-base leading-7 text-black/55">
				把日期、行李、費用和每個人的任務，集中在這趟旅程裡。
			</p>
			<div class="mt-5 flex flex-wrap gap-4 text-sm text-black/55">
				{#if data.trip.destination}<span class="flex items-center gap-2"
						><MapPin class="size-4 text-[#779a00]" />{data.trip.destination}</span
					>{/if}
				{#if data.trip.startDate}<span class="flex items-center gap-2"
						><CalendarDays class="size-4 text-[#779a00]" />{data.trip.startDate}
						{data.trip.endDate ? `至 ${data.trip.endDate}` : ''}</span
					>{/if}
			</div>
		</div>
		<Button
			href={route(`${base}/itinerary`)}
			class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
			><Plus class="size-4" /> 新增行程</Button
		>
	</section>

	<section class="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
		{#each cards as card (card.label)}
			{@const Icon = card.icon}
			<Card
				class="rounded-none border-black/10 bg-white shadow-none transition hover:border-black/35"
			>
				<CardContent class="p-5">
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<a href={route(card.href)} class="block">
						<div class="flex items-start justify-between">
							<span class="grid size-10 place-items-center bg-[#d8ff36]"
								><Icon class="size-5" /></span
							><span class="font-mono text-3xl font-black">{card.value}</span>
						</div>
						<h3 class="mt-8 text-xl font-black">{card.label}</h3>
						<p class="mt-1 text-sm text-black/50">{card.text}</p>
					</a>
				</CardContent>
			</Card>
		{/each}
	</section>
</main>
