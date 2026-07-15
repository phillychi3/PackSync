<script lang="ts">
	import './layout.css'
	import { WifiOff } from '@lucide/svelte'
	import ConfirmDialog from '$lib/components/confirm-dialog.svelte'
	import Toaster from '$lib/components/toaster.svelte'
	import { onMount } from 'svelte'

	let { children } = $props()
	let offline = $state(false)

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {})
		}
		offline = !navigator.onLine
		const handleOnline = () => (offline = false)
		const handleOffline = () => (offline = true)
		window.addEventListener('online', handleOnline)
		window.addEventListener('offline', handleOffline)
		return () => {
			window.removeEventListener('online', handleOnline)
			window.removeEventListener('offline', handleOffline)
		}
	})
</script>

{#if offline}
	<div
		class="fixed inset-x-0 top-0 z-[1300] flex items-center justify-center gap-2 bg-[#151817] py-1.5 text-xs font-bold text-white"
		role="status"
	>
		<WifiOff class="size-3.5" /> 目前離線，顯示的是快取資料，變更可能無法儲存。
	</div>
{/if}
{@render children()}
<Toaster />
<ConfirmDialog />
