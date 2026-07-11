<script lang="ts">
	import { resolve } from '$app/paths'
	import {
		ArrowLeft,
		CalendarDays,
		CheckSquare,
		CircleDollarSign,
		ListChecks,
		Map,
		Users
	} from '@lucide/svelte'
	import type { LayoutData } from './$types'
	import type { Snippet } from 'svelte'

	let { data, children }: { data: LayoutData; children: Snippet } = $props()
	const route = resolve as unknown as (path: string) => string
	const base = $derived(`/trips/${data.trip.id}`)
	const links = $derived([
		{ href: base, label: '總覽', icon: Map },
		{ href: `${base}/itinerary`, label: '行程', icon: CalendarDays },
		{ href: `${base}/packing`, label: '行李', icon: CheckSquare },
		{ href: `${base}/expenses`, label: '費用', icon: CircleDollarSign },
		{ href: `${base}/todos`, label: '待辦', icon: ListChecks },
		{ href: `${base}/critical`, label: '重要事項', icon: CheckSquare },
		{ href: `${base}/members`, label: '成員', icon: Users }
	])
</script>

<svelte:head>
	<title>{data.trip.name} | PackSync</title>
</svelte:head>

<div class="min-h-screen bg-[#f4f5f2] text-[#151817]">
	<header class="border-b border-black/15 bg-[#f4f5f2]/95 backdrop-blur">
		<div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
			<div class="min-w-0">
				<a
					href={resolve('/trips')}
					class="mb-2 inline-flex items-center gap-2 text-xs font-bold text-black/50 hover:text-black"
				>
					<ArrowLeft class="size-3.5" /> 返回旅程
				</a>
				<h1 class="truncate text-xl font-black tracking-[-0.035em] sm:text-2xl">
					{data.trip.name}
				</h1>
				{#if data.trip.destination}<p class="truncate text-sm text-black/50">
						{data.trip.destination}
					</p>{/if}
			</div>
			<span
				class="shrink-0 bg-[#d8ff36] px-2 py-1 font-mono text-[10px] font-bold uppercase text-black"
				>{data.role}</span
			>
		</div>
		<nav
			class="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-3 sm:px-8"
			aria-label="旅程功能"
		>
			{#each links as link (link.href)}
				{@const Icon = link.icon}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={route(link.href)}
					class="flex shrink-0 items-center gap-2 border border-transparent px-3 py-2 text-sm font-bold text-black/55 transition hover:border-black/15 hover:bg-white hover:text-black"
				>
					<Icon class="size-4" />
					{link.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>
	</header>
	{@render children()}
</div>
