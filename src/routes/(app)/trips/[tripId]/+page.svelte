<script lang="ts">
	import { invalidateAll } from '$app/navigation'
	import { resolve } from '$app/paths'
	import {
		CalendarDays,
		CheckSquare,
		CircleDollarSign,
		Flag,
		ListChecks,
		MapPin,
		Navigation,
		Plus,
		ShieldAlert,
		Users
	} from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Card, CardContent } from '$lib/components/ui/card'
	import { confirmDialog } from '$lib/stores/confirm'
	import { toast } from '$lib/stores/toast'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	const route = resolve as unknown as (path: string) => string
	const base = $derived(`/trips/${data.trip.id}`)
	const canManage = $derived(data.role === 'owner' || data.role === 'admin')
	let updatingStatus = $state(false)

	const statusLabel: Record<string, string> = {
		planning: '規劃中',
		ongoing: '旅途中',
		completed: '已完成'
	}

	const nextStop = $derived.by(() => {
		const now = new Date()
		const today = now.toISOString().slice(0, 10)
		const time = now.toTimeString().slice(0, 5)
		return (
			data.itinerary.find((item) => {
				if (item.date > today) return true
				if (item.date < today) return false
				const end = item.endTime ?? item.startTime
				return end === null || end >= time
			}) ?? null
		)
	})

	async function setStatus(status: 'planning' | 'ongoing' | 'completed') {
		updatingStatus = true
		const res = await fetch(`/api/trips/${data.trip.id}`, {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ status })
		})
		if (res.ok) {
			toast.success(
				status === 'ongoing'
					? '旅程開始，祝旅途愉快！'
					: `旅程狀態已更新為「${statusLabel[status]}」`
			)
			await invalidateAll()
		} else {
			toast.error('更新旅程狀態失敗，請稍後再試')
		}
		updatingStatus = false
	}

	async function startTrip() {
		const ok = await confirmDialog({
			title: '開始旅程',
			message: '開始後首頁會切換成旅途中模式，優先顯示下一站與待確認事項。',
			confirmLabel: '開始旅程'
		})
		if (ok) await setStatus('ongoing')
	}

	async function endTrip() {
		const ok = await confirmDialog({
			title: '結束旅程',
			message: '結束後旅程會標記為已完成，內容保留為紀錄。',
			confirmLabel: '結束旅程'
		})
		if (ok) await setStatus('completed')
	}

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
	{#if data.trip.status === 'completed'}
		<div
			class="mb-6 flex flex-wrap items-center justify-between gap-3 border border-black/15 bg-white px-4 py-3"
		>
			<p class="flex items-center gap-2 text-sm font-bold">
				<Flag class="size-4 text-[#779a00]" /> 這趟旅程已完成，內容保留為紀錄。
			</p>
			{#if canManage}
				<button
					type="button"
					disabled={updatingStatus}
					class="border border-black/20 px-3 py-1 font-mono text-xs font-bold hover:border-black"
					onclick={() => setStatus('ongoing')}
				>
					重新開啟旅程
				</button>
			{/if}
		</div>
	{/if}

	{#if data.trip.status === 'ongoing'}
		<section class="border-b border-black/15 pb-8">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">
					PACKSYNC / <span class="bg-[#d8ff36] px-1.5 py-0.5 text-black">旅途中</span>
				</p>
				{#if canManage}
					<div class="flex gap-2">
						<button
							type="button"
							disabled={updatingStatus}
							class="border border-black/20 px-3 py-1.5 font-mono text-xs font-bold hover:border-black"
							onclick={() => setStatus('planning')}
						>
							回到規劃中
						</button>
						<button
							type="button"
							disabled={updatingStatus}
							class="border border-black/20 px-3 py-1.5 font-mono text-xs font-bold hover:border-black"
							onclick={endTrip}
						>
							結束旅程
						</button>
					</div>
				{/if}
			</div>
			<h2 class="mt-3 text-3xl font-black tracking-[-0.05em] sm:text-4xl">現在最重要的事。</h2>
			<div class="mt-6 grid gap-4 sm:grid-cols-3">
				<a
					href={route(`${base}/itinerary`)}
					class="border border-black bg-white p-5 transition hover:bg-[#fbffe8]"
				>
					<p class="flex items-center gap-2 font-mono text-xs font-bold text-[#779a00]">
						<Navigation class="size-4" /> 下一站
					</p>
					{#if nextStop}
						<h3 class="mt-3 text-xl font-black">{nextStop.title}</h3>
						<p class="mt-1 text-sm text-black/55">
							{nextStop.date}{nextStop.startTime ? ` · ${nextStop.startTime}` : ''}
						</p>
						{#if nextStop.place}
							<p class="mt-1 flex items-center gap-1 text-xs text-black/50">
								<MapPin class="size-3 shrink-0" />{nextStop.place.name}
							</p>
						{/if}
					{:else}
						<p class="mt-3 text-sm text-black/50">接下來沒有排定的行程。</p>
					{/if}
				</a>
				<a
					href={route(`${base}/critical`)}
					class="border p-5 transition {data.criticalUnconfirmed > 0
						? 'border-amber-600 bg-amber-50 hover:bg-amber-100'
						: 'border-black/15 bg-white hover:bg-[#fbffe8]'}"
				>
					<p
						class="flex items-center gap-2 font-mono text-xs font-bold {data.criticalUnconfirmed > 0
							? 'text-amber-700'
							: 'text-[#779a00]'}"
					>
						<ShieldAlert class="size-4" /> 重要物品
					</p>
					<h3 class="mt-3 text-xl font-black">
						{data.criticalUnconfirmed > 0 ? `${data.criticalUnconfirmed} 項待確認` : '全部已確認'}
					</h3>
					<p class="mt-1 text-sm text-black/55">出發前檢查護照、票券等物品。</p>
				</a>
				<a
					href={route(`${base}/expenses`)}
					class="border border-black/15 bg-white p-5 transition hover:bg-[#fbffe8]"
				>
					<p class="flex items-center gap-2 font-mono text-xs font-bold text-[#779a00]">
						<CircleDollarSign class="size-4" /> 待付款
					</p>
					<h3 class="mt-3 text-xl font-black">
						{data.pendingPaymentCount > 0
							? `${data.trip.currency} ${data.pendingPaymentTotal}`
							: '沒有待付款'}
					</h3>
					<p class="mt-1 text-sm text-black/55">
						{data.pendingPaymentCount > 0
							? `${data.pendingPaymentCount} 筆結算等你付款`
							: '目前的分帳都已結清。'}
					</p>
				</a>
			</div>
		</section>
	{:else}
		<section class="grid gap-8 border-b border-black/15 pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
			<div>
				<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">
					PACKSYNC / 旅程總覽 ·
					<span class="text-black/60">{statusLabel[data.trip.status]}</span>
				</p>
				<h2 class="mt-3 max-w-3xl text-4xl font-black tracking-[-0.055em] sm:text-6xl">
					{data.trip.status === 'completed' ? '旅程紀錄。' : '準備好一起出發。'}
				</h2>
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
			<div class="flex flex-wrap gap-2">
				{#if data.trip.status === 'planning' && canManage}
					<Button
						type="button"
						disabled={updatingStatus}
						class="h-11 rounded-none border border-black bg-white px-5 font-bold text-black hover:bg-[#fbffe8]"
						onclick={startTrip}><Flag class="size-4" /> 開始旅程</Button
					>
				{/if}
				{#if data.trip.status !== 'completed'}
					<Button
						href={route(`${base}/itinerary`)}
						class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
						><Plus class="size-4" /> 新增行程</Button
					>
				{/if}
			</div>
		</section>
	{/if}

	<section class="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
		{#each cards as card (card.label)}
			{@const Icon = card.icon}
			<Card
				class="rounded-none border-black/10 bg-white shadow-none transition hover:border-black/35"
			>
				<CardContent class="p-5">
					<a href={route(card.href)} class="block">
						<div class="flex items-start justify-between">
							<span class="grid size-10 place-items-center bg-[#d8ff36] text-black"
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
