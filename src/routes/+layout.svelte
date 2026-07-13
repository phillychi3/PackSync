<script lang="ts">
	import './layout.css'
	import { onMount } from 'svelte'

	let { children } = $props()

	onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js', { type: 'module' }).catch(() => {})
		}
	})
</script>

{@render children()}
