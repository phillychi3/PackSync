<script lang="ts">
	import { resolve } from '$app/paths'
	import { page } from '$app/state'
	import {
		ArrowLeft,
		Bell,
		Bot,
		CalendarDays,
		CheckSquare,
		CircleDollarSign,
		Ellipsis,
		ListChecks,
		Map,
		Users
	} from '@lucide/svelte'
	import type { LayoutData } from './$types'
	import type { Snippet } from 'svelte'
	import { onMount } from 'svelte'

	let { data, children }: { data: LayoutData; children: Snippet } = $props()
	const route = resolve as unknown as (path: string) => string
	const base = $derived(`/trips/${data.trip.id}`)
	type InstallPromptEvent = Event & {
		prompt: () => Promise<void>
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
	}
	let installPrompt = $state<InstallPromptEvent | null>(null)
	let canInstall = $state(false)
	let unreadCount = $state(0)

	onMount(() => {
		fetch(`/api/trips/${data.trip.id}/notifications`)
			.then(async (response) => {
				if (!response.ok) return
				const payload: { items: { key: string }[]; readKeys: string[] } = await response.json()
				unreadCount = payload.items.filter((item) => !payload.readKeys.includes(item.key)).length
			})
			.catch(() => {})
		if (window.matchMedia('(display-mode: standalone)').matches) return
		const handleInstallPrompt = (event: Event) => {
			event.preventDefault()
			installPrompt = event as InstallPromptEvent
			canInstall = true
		}
		const handleInstalled = () => {
			installPrompt = null
			canInstall = false
		}
		window.addEventListener('beforeinstallprompt', handleInstallPrompt)
		window.addEventListener('appinstalled', handleInstalled)
		return () => {
			window.removeEventListener('beforeinstallprompt', handleInstallPrompt)
			window.removeEventListener('appinstalled', handleInstalled)
		}
	})

	async function installApp() {
		if (!installPrompt) return
		await installPrompt.prompt()
		await installPrompt.userChoice
		installPrompt = null
		canInstall = false
	}
	const links = $derived([
		{ href: base, label: '總覽', icon: Map },
		{ href: `${base}/itinerary`, label: '行程', icon: CalendarDays },
		{ href: `${base}/packing`, label: '行李', icon: CheckSquare },
		{ href: `${base}/expenses`, label: '費用', icon: CircleDollarSign },
		{ href: `${base}/todos`, label: '待辦', icon: ListChecks },
		{ href: `${base}/critical`, label: '重要事項', icon: CheckSquare },
		{ href: `${base}/members`, label: '成員', icon: Users },
		{ href: `${base}/agent`, label: 'AI Agent', icon: Bot }
	])
	const bottomLinks = $derived([links[0], links[1], links[3], links[2]])
	const moreLinks = $derived([links[4], links[5], links[6], links[7]])
	let moreOpen = $state(false)

	function isCurrent(href: string) {
		const path = page.url.pathname
		if (href === base) return path === base
		return path === href || path.startsWith(`${href}/`)
	}
	const moreCurrent = $derived(moreLinks.some((link) => isCurrent(link.href)))
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
			<div class="flex shrink-0 items-center gap-2">
				{#if canInstall}
					<button
						type="button"
						onclick={installApp}
						class="border border-black/15 bg-white px-2 py-1 text-xs font-bold hover:border-black"
						title="安裝 PackSync"
					>
						安裝 App
					</button>
				{/if}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={route(`${base}/notifications`)}
					class="relative grid size-7 place-items-center border border-black/15 bg-white hover:border-black"
					title="通知"
					aria-label="通知{unreadCount > 0 ? `（${unreadCount} 則未讀）` : ''}"
				>
					<Bell class="size-4" />
					{#if unreadCount > 0}
						<span
							class="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-600 px-1 font-mono text-[9px] font-bold leading-4 text-white"
						>
							{unreadCount > 99 ? '99+' : unreadCount}
						</span>
					{/if}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<span class="bg-[#d8ff36] px-2 py-1 text-[10px] font-bold text-black"
					>{data.role === 'owner' ? '擁有者' : data.role === 'admin' ? '管理員' : '成員'}</span
				>
			</div>
		</div>
		<nav
			class="mx-auto hidden max-w-7xl gap-1 overflow-x-auto px-5 pb-3 sm:flex sm:px-8"
			aria-label="旅程功能"
		>
			{#each links as link (link.href)}
				{@const Icon = link.icon}
				{@const current = isCurrent(link.href)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={route(link.href)}
					aria-current={current ? 'page' : undefined}
					class="flex shrink-0 items-center gap-2 border px-3 py-2 text-sm font-bold transition {current
						? 'border-black bg-[#d8ff36] text-black'
						: 'border-transparent text-black/55 hover:border-black/15 hover:bg-white hover:text-black'}"
				>
					<Icon class="size-4" />
					{link.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
		</nav>
	</header>
	<div class="pb-20 sm:pb-0">
		{@render children()}
	</div>
	{#if moreOpen}
		<button
			type="button"
			class="fixed inset-0 z-[990] bg-black/30 sm:hidden"
			aria-label="關閉更多選單"
			onclick={() => (moreOpen = false)}
		></button>
		<div
			class="fixed inset-x-0 bottom-[calc(3.25rem+env(safe-area-inset-bottom))] z-[1000] border-t border-black/15 bg-white sm:hidden"
			role="menu"
			aria-label="更多功能"
		>
			<div class="grid gap-1 p-3">
				{#each moreLinks as link (link.href)}
					{@const Icon = link.icon}
					{@const current = isCurrent(link.href)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={route(link.href)}
						aria-current={current ? 'page' : undefined}
						class="flex items-center gap-3 border px-3 py-2.5 text-sm font-bold {current
							? 'border-black bg-[#d8ff36] text-black'
							: 'border-transparent text-black/70 hover:bg-[#f4f5f2]'}"
						onclick={() => (moreOpen = false)}
					>
						<Icon class="size-4" />
						{link.label}
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				{/each}
			</div>
		</div>
	{/if}
	<nav
		class="fixed inset-x-0 bottom-0 z-[1000] border-t border-black/15 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
		aria-label="旅程功能（手機）"
	>
		<div class="grid grid-cols-5">
			{#each bottomLinks as link (link.href)}
				{@const Icon = link.icon}
				{@const current = isCurrent(link.href)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={route(link.href)}
					aria-current={current ? 'page' : undefined}
					class="flex flex-col items-center gap-1 py-2 text-[10px] font-bold {current
						? 'bg-[#d8ff36] text-black'
						: 'text-black/50'}"
					onclick={() => (moreOpen = false)}
				>
					<Icon class="size-5" />
					{link.label}
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/each}
			<button
				type="button"
				aria-expanded={moreOpen}
				class="flex flex-col items-center gap-1 py-2 text-[10px] font-bold {moreOpen || moreCurrent
					? 'bg-[#d8ff36] text-black'
					: 'text-black/50'}"
				onclick={() => (moreOpen = !moreOpen)}
			>
				<Ellipsis class="size-5" />
				更多
			</button>
		</div>
	</nav>
</div>
