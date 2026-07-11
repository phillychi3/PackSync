<script lang="ts">
	import AuthPanel from '$lib/components/auth-panel.svelte'
	import type { ActionData } from './$types'
	let { form }: { form: ActionData } = $props()
</script>

<AuthPanel mode="login" message={form?.message} />
