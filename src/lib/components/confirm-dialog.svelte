<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { confirmRequest } from '$lib/stores/confirm'

	function answer(confirmed: boolean) {
		$confirmRequest?.resolve(confirmed)
		confirmRequest.set(null)
	}

	function onKeydown(event: KeyboardEvent) {
		if ($confirmRequest && event.key === 'Escape') answer(false)
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if $confirmRequest}
	<div class="fixed inset-0 z-[1200] grid place-items-center px-4">
		<button
			type="button"
			class="absolute inset-0 bg-black/40"
			aria-label="取消"
			onclick={() => answer(false)}
		></button>
		<div
			class="relative w-full max-w-sm border border-black bg-white p-5"
			role="alertdialog"
			aria-modal="true"
			aria-label={$confirmRequest.title}
		>
			<h3 class="text-lg font-black">{$confirmRequest.title}</h3>
			<p class="mt-2 text-sm leading-6 text-black/60">{$confirmRequest.message}</p>
			<div class="mt-5 flex justify-end gap-2">
				<Button
					type="button"
					variant="outline"
					class="h-9 rounded-none font-bold"
					onclick={() => answer(false)}
				>
					{$confirmRequest.cancelLabel}
				</Button>
				<Button
					type="button"
					class="h-9 rounded-none font-bold {$confirmRequest.danger
						? 'bg-red-600 text-white hover:bg-red-700'
						: 'bg-[#d8ff36] text-black hover:bg-[#c8ef28]'}"
					onclick={() => answer(true)}
				>
					{$confirmRequest.confirmLabel}
				</Button>
			</div>
		</div>
	</div>
{/if}
