<script lang="ts">
	import { goto } from '$app/navigation'
	import { Button } from '$lib/components/ui/button'
	import { AlertCircle, CheckCircle2, LogIn, Plane, Users } from '@lucide/svelte'
	import type { ActionData, PageData } from './$types'

	let { data, form }: { data: PageData; form: ActionData } = $props()

	const result = $derived(form ?? data)
	const trip = $derived(data.trip)
	const isSuccess = $derived(result.state === 'accepted')
	const isReady = $derived(result.state === 'ready')
	const isLoginRequired = $derived(result.state === 'login_required')
	const isAlreadyMember = $derived(result.state === 'already_member')
	const tripHref = $derived(
		result.tripId ? `/trips/${result.tripId}` : trip ? `/trips/${trip.id}` : '/trips'
	)

	function goToLogin() {
		const currentPath = `${location.pathname}${location.search}`
		goto(`/login?redirectTo=${encodeURIComponent(currentPath)}`)
	}
</script>

<svelte:head>
	<title>旅程邀請 | PackSync</title>
	<meta name="description" content="接受 PackSync 旅程邀請" />
</svelte:head>

<main class="grid min-h-screen place-items-center bg-[#f4f5f2] px-5 py-10 text-[#151817]">
	<section class="w-full max-w-2xl border border-black/10 bg-white p-6 sm:p-10">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">PACKSYNC / INVITE</p>

		<div class="mt-6 flex items-start gap-4">
			<div
				class={`grid size-12 shrink-0 place-items-center ${
					isSuccess ? 'bg-[#d8ff36]' : isReady ? 'bg-[#eef0eb]' : 'bg-[#ffe7df]'
				}`}
			>
				{#if isSuccess}
					<CheckCircle2 class="size-6" />
				{:else if isReady || isLoginRequired}
					<Plane class="size-6" />
				{:else}
					<AlertCircle class="size-6" />
				{/if}
			</div>

			<div class="min-w-0">
				<h1 class="text-3xl font-black tracking-[-0.04em] sm:text-5xl">
					{#if isSuccess}
						已加入旅程
					{:else if isReady}
						接受旅程邀請
					{:else if isAlreadyMember}
						你已經在旅程裡
					{:else}
						邀請無法使用
					{/if}
				</h1>
				<p class="mt-4 text-lg font-bold">{result.message}</p>
			</div>
		</div>

		{#if trip}
			<div class="mt-8 border border-black/10 bg-[#f8f9f6] p-5">
				<p class="font-mono text-[10px] font-bold tracking-[0.16em] text-black/40">TRIP</p>
				<h2 class="mt-2 truncate text-2xl font-black tracking-[-0.03em]">{trip.name}</h2>
				{#if trip.destination || trip.description}
					<p class="mt-3 line-clamp-3 leading-7 text-black/55">
						{trip.destination || trip.description}
					</p>
				{/if}
			</div>
		{/if}

		<div class="mt-8 flex flex-col gap-3 sm:flex-row">
			{#if isReady}
				<form method="POST">
					<Button
						type="submit"
						class="h-11 w-full rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28] sm:w-auto"
					>
						<Users class="size-4" />
						接受邀請
					</Button>
				</form>
			{:else if isLoginRequired}
				<Button
					type="button"
					class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
					onclick={goToLogin}
				>
					<LogIn class="size-4" />
					前往登入
				</Button>
			{:else if isSuccess || isAlreadyMember}
				<Button
					href={tripHref}
					class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
				>
					<Plane class="size-4" />
					開啟旅程
				</Button>
			{/if}

			<Button
				href="/trips"
				variant="outline"
				class="h-11 rounded-none border-black/20 px-5 font-bold"
			>
				回到我的旅程
			</Button>
		</div>
	</section>
</main>
