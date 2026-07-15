<script lang="ts">
	import { Ellipsis } from '@lucide/svelte'

	type Action = {
		label: string
		icon?: typeof Ellipsis
		danger?: boolean
		onClick: () => void
	}
	let { actions }: { actions: Action[] } = $props()
	let open = $state(false)
</script>

<div class="relative">
	<button
		type="button"
		aria-haspopup="menu"
		aria-expanded={open}
		title="更多操作"
		class="grid size-7 place-items-center text-black/35 hover:text-black"
		onclick={() => (open = !open)}
	>
		<Ellipsis class="size-4" />
	</button>
	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-[900] cursor-default"
			aria-label="關閉選單"
			onclick={() => (open = false)}
		></button>
		<div
			class="absolute right-0 top-8 z-[910] w-32 border border-black/15 bg-white shadow-lg"
			role="menu"
		>
			{#each actions as action (action.label)}
				{@const Icon = action.icon}
				<button
					type="button"
					role="menuitem"
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold {action.danger
						? 'text-red-600 hover:bg-red-50'
						: 'text-black/70 hover:bg-[#f4f5f2]'}"
					onclick={() => {
						open = false
						action.onClick()
					}}
				>
					{#if Icon}<Icon class="size-4" />{/if}
					{action.label}
				</button>
			{/each}
		</div>
	{/if}
</div>
