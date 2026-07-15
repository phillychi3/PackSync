<script lang="ts">
	let {
		name,
		image = null,
		class: className = 'size-10'
	}: { name: string; image?: string | null; class?: string } = $props()
</script>

{#if image}
	<img src={image} alt={name} class="{className} shrink-0 border border-black/10 object-cover" />
{:else}
	<span class="{className} grid shrink-0 place-items-center bg-[#eef0eb] font-bold">
		{name.slice(0, 1).toUpperCase()}
	</span>
{/if}
