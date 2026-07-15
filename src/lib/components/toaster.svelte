<script lang="ts">
	import { CheckCircle2, CircleAlert, Info, X } from '@lucide/svelte'
	import { dismissToast, toasts } from '$lib/stores/toast'
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-20 z-[1100] flex flex-col items-center gap-2 px-4 sm:bottom-6"
	aria-live="polite"
>
	{#each $toasts as t (t.id)}
		<div
			class="pointer-events-auto flex w-full max-w-sm items-center gap-3 border bg-white px-4 py-3 shadow-lg {t.type ===
			'error'
				? 'border-red-600'
				: t.type === 'success'
					? 'border-[#779a00]'
					: 'border-black/20'}"
			role="status"
		>
			{#if t.type === 'success'}
				<CheckCircle2 class="size-4 shrink-0 text-[#779a00]" />
			{:else if t.type === 'error'}
				<CircleAlert class="size-4 shrink-0 text-red-600" />
			{:else}
				<Info class="size-4 shrink-0 text-black/50" />
			{/if}
			<p class="min-w-0 flex-1 text-sm font-bold">{t.message}</p>
			{#if t.action}
				<button
					type="button"
					class="shrink-0 border border-black/20 px-2 py-1 font-mono text-xs font-bold hover:border-black"
					onclick={() => {
						t.action?.onClick()
						dismissToast(t.id)
					}}
				>
					{t.action.label}
				</button>
			{/if}
			<button
				type="button"
				class="shrink-0 text-black/35 hover:text-black"
				aria-label="關閉通知"
				onclick={() => dismissToast(t.id)}
			>
				<X class="size-4" />
			</button>
		</div>
	{/each}
</div>
