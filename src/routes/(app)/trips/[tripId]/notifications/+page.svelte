<script lang="ts">
	import { Bell, CalendarDays, CircleDollarSign, ListChecks, ShieldAlert } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Notification = {
		id: string
		type: 'itinerary' | 'critical' | 'bills' | 'todos'
		title: string
		body: string
		date?: string
	}
	type Schedule = { id: string; title: string; date: string; startTime: string | null }
	type Todo = { id: string; title: string; dueDate: string | null; isCompleted: boolean }
	type Critical = {
		id: string
		name: string
		scheduleItemId: string | null
		confirmations: { userId: string; scheduleItemId: string | null }[]
	}
	type Settlement = {
		id: string
		amount: number
		isSettled: boolean
		fromUserId: string
		toUserId: string
	}

	let { data }: { data: PageData } = $props()
	let notifications = $state<Notification[]>([])
	let loading = $state(true)
	let pushConfigured = $state(false)
	let pushEnabled = $state(false)
	let pushBusy = $state(false)
	let pushMessage = $state('')

	const icons = {
		itinerary: CalendarDays,
		critical: ShieldAlert,
		bills: CircleDollarSign,
		todos: ListChecks
	}

	async function load() {
		const [scheduleRes, criticalRes, todoRes, settlementRes] = await Promise.all([
			fetch(`/api/trips/${data.trip.id}/itinerary`),
			fetch(`/api/trips/${data.trip.id}/critical`),
			fetch(`/api/trips/${data.trip.id}/todos`),
			fetch(`/api/trips/${data.trip.id}/settlements`)
		])
		const schedules: Schedule[] = scheduleRes.ok ? await scheduleRes.json() : []
		const criticals: Critical[] = criticalRes.ok ? await criticalRes.json() : []
		const todos: Todo[] = todoRes.ok ? await todoRes.json() : []
		const settlements: Settlement[] = settlementRes.ok ? await settlementRes.json() : []
		const today = new Date().toISOString().slice(0, 10)
		const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
		const upcomingSchedules = schedules.filter(
			(item) => item.date >= today && item.date <= nextWeek
		)
		const criticalNotifications = criticals.flatMap((item) => {
			const relatedSchedules = item.scheduleItemId
				? upcomingSchedules.filter((schedule) => schedule.id === item.scheduleItemId)
				: upcomingSchedules
			return relatedSchedules
				.filter(
					(schedule) =>
						!item.confirmations.some(
							(confirmation) =>
								confirmation.userId === data.user.id && confirmation.scheduleItemId === schedule.id
						)
				)
				.map((schedule) => ({
					id: `critical:${item.id}:${schedule.id}`,
					type: 'critical' as const,
					title: `出發前確認：${item.name}`,
					body: `${schedule.date}${schedule.startTime ? ` ${schedule.startTime}` : ''} 開始前請確認。`,
					date: schedule.date
				}))
		})
		notifications = [
			...schedules
				.filter((item) => item.date >= today && item.date <= nextWeek)
				.map((item) => ({
					id: `schedule:${item.id}`,
					type: 'itinerary' as const,
					title: item.title,
					body: `${item.date}${item.startTime ? ` ${item.startTime}` : ''} 的行程即將到來。`,
					date: item.date
				})),
			...criticalNotifications,
			...settlements
				.filter((item) => !item.isSettled)
				.map((item) => ({
					id: `bill:${item.id}`,
					type: 'bills' as const,
					title: '有待處理的轉帳',
					body: `尚有 ${item.amount.toFixed(2)} 的款項未付清。`
				})),
			...todos
				.filter((item) => !item.isCompleted && item.dueDate && item.dueDate <= nextWeek)
				.map((item) => ({
					id: `todo:${item.id}`,
					type: 'todos' as const,
					title: item.title,
					body:
						item.dueDate && item.dueDate < today
							? '已逾期，請盡快處理。'
							: `截止日：${item.dueDate}`,
					date: item.dueDate ?? undefined
				}))
		]
		loading = false
	}

	function decodeBase64(value: string) {
		const padding = '='.repeat((4 - (value.length % 4)) % 4)
		return Uint8Array.from(atob((value + padding).replace(/-/g, '+').replace(/_/g, '/')), (char) =>
			char.charCodeAt(0)
		)
	}
	async function togglePush() {
		if (pushBusy || !pushConfigured || !('serviceWorker' in navigator)) return
		pushBusy = true
		pushMessage = ''
		try {
			const registration = await navigator.serviceWorker.register('/service-worker.js', {
				type: 'module'
			})
			if (pushEnabled) {
				const subscription = await registration.pushManager.getSubscription()
				if (subscription) {
					await fetch('/api/push/subscription', {
						method: 'DELETE',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ endpoint: subscription.endpoint })
					})
					await subscription.unsubscribe()
				}
				pushEnabled = false
			} else {
				const permission = await Notification.requestPermission()
				if (permission !== 'granted') throw new Error('請允許瀏覽器通知權限。')
				const keyResponse = await fetch('/api/push/vapid-public-key')
				if (!keyResponse.ok) throw new Error('Web Push 尚未完成伺服器設定。')
				const { publicKey } = await keyResponse.json()
				const subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: decodeBase64(publicKey)
				})
				const response = await fetch('/api/push/subscription', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(subscription.toJSON())
				})
				if (!response.ok) throw new Error('無法儲存推播訂閱。')
				pushEnabled = true
			}
		} catch (error) {
			pushMessage = error instanceof Error ? error.message : 'Web Push 設定失敗。'
		} finally {
			pushBusy = false
		}
	}
	onMount(() => {
		fetch('/api/push/vapid-public-key').then(async (response) => {
			pushConfigured = response.ok
			if (response.ok && 'serviceWorker' in navigator) {
				const registration = await navigator.serviceWorker.register('/service-worker.js', {
					type: 'module'
				})
				pushEnabled = Boolean(await registration.pushManager.getSubscription())
			}
		})
		load()
	})
</script>

<svelte:head><title>通知中心 | {data.trip.name}</title></svelte:head>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<div class="border-b border-black/15 pb-6">
		<p class="font-mono text-xs font-bold tracking-widest text-black/45">NOTIFICATIONS</p>
		<h1 class="mt-3 text-4xl font-black">通知中心</h1>
		<p class="mt-3 text-black/55">集中查看行程、重要物品、帳單與待辦提醒。</p>
	</div>
	<div class="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
		<section class="grid gap-3">
			{#if loading}<div class="border border-black/10 bg-white p-6 text-black/50">
					正在整理通知…
				</div>{:else if notifications.length === 0}<div
					class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50"
				>
					<Bell class="mx-auto mb-3 size-8" />目前沒有需要處理的通知。
				</div>{:else}
				{#each notifications as item (item.id)}
					{@const Icon = icons[item.type]}
					<article class="flex gap-4 border border-black/10 bg-white p-5">
						<div class="grid size-10 shrink-0 place-items-center bg-[#d8ff36]">
							<Icon class="size-5" />
						</div>
						<div class="min-w-0">
							<h2 class="font-bold">{item.title}</h2>
							<p class="mt-1 text-sm leading-6 text-black/55">{item.body}</p>
							{#if item.date}<p class="mt-2 font-mono text-xs text-black/40">{item.date}</p>{/if}
						</div>
					</article>
				{/each}
			{/if}
		</section>
		<aside class="h-fit border border-black/10 bg-white p-5">
			<h2 class="flex items-center gap-2 font-black"><Bell class="size-4" />推播通知</h2>
			<p class="mt-2 text-sm leading-6 text-black/50">
				啟用後，即使沒有開啟頁面，也能收到旅程提醒。
			</p>
			<button
				type="button"
				class="mt-4 h-10 w-full border border-black/20 px-3 text-sm font-bold hover:bg-[#d8ff36] disabled:cursor-not-allowed disabled:opacity-40"
				disabled={!pushConfigured || pushBusy}
				onclick={togglePush}
				>{pushBusy
					? '設定中…'
					: pushEnabled
						? '停用 Web Push'
						: pushConfigured
							? '啟用 Web Push'
							: '尚未設定 VAPID'}</button
			>
		</aside>
	</div>
</main>
