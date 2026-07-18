<script lang="ts">
	import './layout.css'
	import { WifiOff } from '@lucide/svelte'
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte'
	import Toaster from '$lib/components/toaster.svelte'
	import { isNetworkReachable } from '$lib/network'
	import { toast } from '$lib/stores/toast'
	import { initializeDarkMode } from '$lib/theme'
	import { onNavigate } from '$app/navigation'
	import { onMount } from 'svelte'

	let { children } = $props()
	let offline = $state(false)
	let offlineSince = $state<string | null>(null)

	onNavigate((navigation) => {
		if (!document.startViewTransition) return
		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve()
				await navigation.complete
			})
		})
	})

	onMount(() => {
		initializeDarkMode()
		const markOffline = () => {
			offline = true
			offlineSince = new Intl.DateTimeFormat('zh-TW', {
				hour: '2-digit',
				minute: '2-digit'
			}).format(new Date())
		}
		const refreshConnectivity = async (showRestored = false) => {
			const online = await isNetworkReachable()
			if (!online) {
				markOffline()
				return
			}
			const wasOffline = offline
			offline = false
			offlineSince = null
			if (showRestored || wasOffline) toast.success('已恢復連線')
			navigator.serviceWorker?.controller?.postMessage({ type: 'replay-outbox' })
		}
		void refreshConnectivity()
		const handleOnline = () => void refreshConnectivity(true)
		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', markOffline)

		const handleSwMessage = (event: MessageEvent) => {
			const data = event.data as { type?: string; count?: number } | null
			if (data?.type === 'outbox-flushed') {
				toast.success(`已同步離線期間的 ${data.count ?? 0} 項變更`, {
					duration: 8000,
					action: { label: '重新整理', onClick: () => location.reload() }
				})
			}
		}
		navigator.serviceWorker?.addEventListener('message', handleSwMessage)
		return () => {
			window.removeEventListener('online', handleOnline)
			window.removeEventListener('offline', markOffline)
			navigator.serviceWorker?.removeEventListener('message', handleSwMessage)
		}
	})
</script>

{#if offline}
	<div
		class="fixed inset-x-0 top-0 z-[1300] flex flex-wrap items-center justify-center gap-2 bg-[#151817] px-4 py-1.5 text-center text-xs font-bold text-white"
		role="status"
	>
		<WifiOff class="size-3.5 shrink-0" />
		目前離線{offlineSince
			? `（自 ${offlineSince} 起）`
			: ''}，顯示的是快取資料；送出的變更會暫存並在恢復連線後自動同步。
	</div>
{/if}
{@render children()}
<Toaster />
<ConfirmDialog />
