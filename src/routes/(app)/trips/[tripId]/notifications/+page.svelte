<script lang="ts">
	import { Bell, CalendarDays, CircleDollarSign, ListChecks, ShieldAlert } from '@lucide/svelte'
	import { toast } from '$lib/stores/toast'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	type Notification = {
		key: string
		type: 'itinerary' | 'critical' | 'bills' | 'todos'
		title: string
		body: string
		date?: string
		url: string
	}

	let { data }: { data: PageData } = $props()
	let notifications = $state<Notification[]>([])
	let readKeys = $state<string[]>([])
	let loading = $state(true)
	const unreadCount = $derived(notifications.filter((item) => !readKeys.includes(item.key)).length)
	let pushConfigured = $state(false)
	let pushEnabled = $state(false)
	let pushBusy = $state(false)
	let pushMessage = $state('')

	type Prefs = {
		remindItinerary: boolean
		remindCritical: boolean
		remindBills: boolean
		remindTodos: boolean
		leadHours: number
	}
	let prefs = $state<Prefs>({
		remindItinerary: true,
		remindCritical: true,
		remindBills: true,
		remindTodos: true,
		leadHours: 24
	})
	let prefsSaving = $state(false)

	const PREF_TOGGLES: { key: keyof Omit<Prefs, 'leadHours'>; label: string }[] = [
		{ key: 'remindItinerary', label: '行程提醒' },
		{ key: 'remindCritical', label: '重要物品確認' },
		{ key: 'remindBills', label: '待付款提醒' },
		{ key: 'remindTodos', label: '待辦到期提醒' }
	]

	async function savePrefs() {
		prefsSaving = true
		const res = await fetch('/api/me/notification-preferences', {
			method: 'PUT',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(prefs)
		})
		if (res.ok) {
			prefs = await res.json()
			toast.success('通知偏好已儲存')
		} else {
			toast.error('儲存通知偏好失敗')
		}
		prefsSaving = false
	}

	const icons = {
		itinerary: CalendarDays,
		critical: ShieldAlert,
		bills: CircleDollarSign,
		todos: ListChecks
	}

	async function load() {
		const response = await fetch(`/api/trips/${data.trip.id}/notifications`)
		if (response.ok) {
			const payload = await response.json()
			notifications = payload.items
			readKeys = payload.readKeys
		}
		loading = false
	}

	async function markRead(keys: string[]) {
		const unread = keys.filter((key) => !readKeys.includes(key))
		if (unread.length === 0) return
		readKeys = [...readKeys, ...unread]
		await fetch(`/api/trips/${data.trip.id}/notifications`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ keys: unread })
		})
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
		fetch('/api/me/notification-preferences').then(async (response) => {
			if (response.ok) prefs = await response.json()
		})
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
	<div
		class="flex flex-col gap-4 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="font-mono text-xs font-bold tracking-widest text-black/45">NOTIFICATIONS</p>
			<h1 class="mt-3 text-4xl font-black">通知中心</h1>
			<p class="mt-3 text-black/55">集中查看行程、重要物品、帳單與待辦提醒。</p>
		</div>
		{#if unreadCount > 0}
			<button
				type="button"
				class="h-10 shrink-0 border border-black/20 px-4 text-sm font-bold hover:border-black"
				onclick={() => markRead(notifications.map((item) => item.key))}
			>
				全部標為已讀（{unreadCount}）
			</button>
		{/if}
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
				{#each notifications as item (item.key)}
					{@const Icon = icons[item.type]}
					{@const unread = !readKeys.includes(item.key)}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href={item.url}
						class="flex gap-4 border p-5 transition {unread
							? 'border-black/30 bg-white hover:border-black'
							: 'border-black/10 bg-white opacity-60 hover:opacity-100'}"
						onclick={() => markRead([item.key])}
					>
						<div
							class="grid size-10 shrink-0 place-items-center {unread
								? 'bg-[#d8ff36]'
								: 'bg-[#eef0eb]'}"
						>
							<Icon class="size-5" />
						</div>
						<div class="min-w-0 flex-1">
							<h2 class="flex items-center gap-2 font-bold">
								{item.title}
								{#if unread}<span class="size-2 shrink-0 rounded-full bg-[#779a00]"></span>{/if}
							</h2>
							<p class="mt-1 text-sm leading-6 text-black/55">{item.body}</p>
							{#if item.date}<p class="mt-2 font-mono text-xs text-black/40">{item.date}</p>{/if}
						</div>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
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
			{#if pushMessage}<p class="mt-2 text-xs text-red-600">{pushMessage}</p>{/if}

			<div class="mt-6 border-t border-black/10 pt-5">
				<h3 class="font-black">通知偏好</h3>
				<div class="mt-3 grid gap-2.5">
					{#each PREF_TOGGLES as t (t.key)}
						<label class="flex cursor-pointer items-center justify-between gap-3 text-sm font-bold">
							{t.label}
							<input type="checkbox" bind:checked={prefs[t.key]} class="size-4 accent-[#d8ff36]" />
						</label>
					{/each}
					<label class="mt-1 grid gap-1.5 text-sm font-bold">
						提前提醒時間
						<select
							bind:value={prefs.leadHours}
							class="h-9 border border-black/20 bg-[#fbfcf8] px-2 text-sm"
						>
							<option value={3}>3 小時前</option>
							<option value={6}>6 小時前</option>
							<option value={12}>12 小時前</option>
							<option value={24}>1 天前</option>
							<option value={48}>2 天前</option>
							<option value={72}>3 天前</option>
						</select>
					</label>
				</div>
				<button
					type="button"
					class="mt-4 h-10 w-full bg-[#d8ff36] px-3 text-sm font-bold hover:bg-[#c8ef28] disabled:opacity-40"
					disabled={prefsSaving}
					onclick={savePrefs}
				>
					{prefsSaving ? '儲存中…' : '儲存偏好'}
				</button>
			</div>
		</aside>
	</div>
</main>
