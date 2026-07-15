<script lang="ts">
	import { resolve } from '$app/paths'
	import { ArrowRight, CircleDollarSign, Plus, RefreshCw } from '@lucide/svelte'
	import { Axis, Bars, Chart, Layer } from 'layerchart'
	import { ChartContainer } from '$lib/components/ui/chart'
	import type { ChartConfig } from '$lib/components/ui/chart'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import UserAvatar from '$lib/components/user-avatar.svelte'
	import { toast } from '$lib/stores/toast'
	import type { PageData } from './$types'

	type Bill = {
		id: string
		title: string
		amount: number
		currency: string
		date: string
		category: string | null
		splitMethod: 'equal' | 'percentage' | 'fixed'
		payers: { userId: string; amount: number }[]
		participants: { userId: string; value: number | null }[]
		items: { amount: number; participants: string | null }[]
	}
	type Member = { userId: string; name: string; email: string }
	type SUser = { id: string; name: string; email: string; image: string | null }
	type Settlement = {
		id: string
		fromUserId: string
		toUserId: string
		amount: number
		isSettled: boolean
		fromUser: SUser
		toUser: SUser
		details?: { billId: string; billTitle: string; itemName: string; amount: number }[]
		billId?: string | null
	}
	type CalculatedTransfer = { fromUserId: string; toUserId: string; amount: number }
	type Calculation = { balances: Record<string, number>; transfers: CalculatedTransfer[] }

	let { data }: { data: PageData } = $props()
	let bills = $state<Bill[]>([])
	let members = $state<Member[]>([])
	let settlements = $state<Settlement[]>([])
	let statsStart = $state('')
	let statsEnd = $state('')
	let chartsReady = $state(false)
	let calculatedBalances = $state<Record<string, number>>({})
	let recalculating = $state(false)
	let calculated = $state(false)

	let total = $derived(bills.reduce((sum, b) => sum + b.amount, 0))
	let filteredBills = $derived(
		bills.filter(
			(bill) => (!statsStart || bill.date >= statsStart) && (!statsEnd || bill.date <= statsEnd)
		)
	)
	let categoryStats = $derived.by(() => {
		const result = new Map<string, number>()
		for (const bill of filteredBills) {
			const amount = Number(bill.amount)
			if (!Number.isFinite(amount)) continue
			const category = bill.category || '未分類'
			result.set(category, (result.get(category) ?? 0) + amount)
		}
		return [...result.entries()].sort((a, b) => b[1] - a[1])
	})
	let categoryChartData = $derived(categoryStats.map(([label, amount]) => ({ label, amount })))
	let categoryChartLabels = $derived(categoryChartData.map((item) => item.label))
	let categoryChartMax = $derived(Math.max(...categoryChartData.map((item) => item.amount), 1))
	let dailyChartData = $derived.by(() => {
		const result = new Map<string, number>()
		for (const bill of filteredBills) {
			const amount = Number(bill.amount)
			if (!Number.isFinite(amount)) continue
			result.set(bill.date, (result.get(bill.date) ?? 0) + amount)
		}
		return [...result.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([label, amount]) => ({ label: label.slice(5), amount }))
	})
	let dailyChartLabels = $derived(dailyChartData.map((item) => item.label))
	let dailyChartMax = $derived(Math.max(...dailyChartData.map((item) => item.amount), 1))
	let memberStats = $derived.by(() => {
		const result = new Map<string, { paid: number; owed: number }>()
		const add = (userId: string, key: 'paid' | 'owed', amount: number) => {
			const current = result.get(userId) ?? { paid: 0, owed: 0 }
			current[key] += amount
			result.set(userId, current)
		}
		for (const bill of filteredBills) {
			for (const payer of bill.payers) add(payer.userId, 'paid', payer.amount)
			if (bill.items.length > 0) {
				for (const item of bill.items) {
					let ids = bill.participants.map((participant) => participant.userId)
					if (item.participants) {
						try {
							ids = JSON.parse(item.participants) as string[]
						} catch {
							ids = []
						}
					}
					if (ids.length > 0) {
						for (const userId of ids) add(userId, 'owed', item.amount / ids.length)
					}
				}
			} else {
				const totalPaid = bill.payers.reduce((sum, payer) => sum + payer.amount, 0)
				for (const participant of bill.participants) {
					const amount =
						bill.splitMethod === 'equal'
							? totalPaid / bill.participants.length
							: bill.splitMethod === 'percentage'
								? totalPaid * ((participant.value ?? 0) / 100)
								: (participant.value ?? 0)
					add(participant.userId, 'owed', amount)
				}
			}
		}
		return members
			.map((member) => ({
				...member,
				...(result.get(member.userId) ?? { paid: 0, owed: 0 })
			}))
			.filter((member) => member.paid > 0 || member.owed > 0)
	})
	let maxCategoryTotal = $derived(Math.max(...categoryStats.map(([, amount]) => amount), 1))
	let maxMemberTotal = $derived(
		Math.max(...memberStats.map((member) => Math.max(member.paid, member.owed)), 1)
	)
	const categoryChartConfig = {
		amount: { label: '支出', color: 'var(--chart-1)' }
	} satisfies ChartConfig
	const dailyChartConfig = {
		amount: { label: '每日支出', color: 'var(--chart-1)' }
	} satisfies ChartConfig
	let pendingSettlements = $derived(settlements.filter((settlement) => !settlement.isSettled))
	let settlementGroups = $derived.by(() => {
		const groups = new Map<string, { title: string; settlements: Settlement[] }>()
		for (const settlement of pendingSettlements) {
			const firstDetail = settlement.details?.[0]
			const key = firstDetail?.billId ?? 'legacy'
			const group = groups.get(key) ?? {
				title: firstDetail?.billTitle ?? '其他費用',
				settlements: []
			}
			group.settlements.push(settlement)
			groups.set(key, group)
		}
		return [...groups.values()]
	})

	let myPendingBalance = $derived.by(() => {
		if (settlements.length === 0) {
			return Math.round((calculatedBalances[data.user.id] ?? 0) * 100) / 100
		}
		let bal = 0
		for (const s of settlements) {
			if (s.isSettled) continue
			if (s.fromUserId === data.user.id) bal -= s.amount
			else if (s.toUserId === data.user.id) bal += s.amount
		}
		return Math.round(bal * 100) / 100
	})

	function userName(u: SUser) {
		return u.name || u.email
	}

	function transfersMatch(current: Settlement[], calculated: CalculatedTransfer[]) {
		const normalize = (items: Array<{ fromUserId: string; toUserId: string; amount: number }>) =>
			items.map((item) => `${item.fromUserId}:${item.toUserId}:${item.amount.toFixed(2)}`).sort()
		return normalize(current).join('|') === normalize(calculated).join('|')
	}

	async function load() {
		const [billsRes, settlementsRes, calculationRes, membersRes] = await Promise.all([
			fetch(`/api/trips/${data.trip.id}/bills`),
			fetch(`/api/trips/${data.trip.id}/settlements`),
			fetch(`/api/trips/${data.trip.id}/settlements/calculate`),
			fetch(`/api/trips/${data.trip.id}/members`)
		])
		const loadedBills: Bill[] = billsRes.ok ? await billsRes.json() : []
		const loadedSettlements: Settlement[] = settlementsRes.ok ? await settlementsRes.json() : []
		const calculation: Calculation | null = calculationRes.ok ? await calculationRes.json() : null
		bills = loadedBills
		if (membersRes.ok) members = await membersRes.json()
		settlements = loadedSettlements

		if (calculation) {
			calculatedBalances = calculation.balances
			calculated = true
			if (!transfersMatch(loadedSettlements, calculation.transfers)) {
				await recalculate()
			}
		} else if (loadedBills.length > 0 && loadedSettlements.length === 0) {
			await recalculate()
		}
	}

	async function recalculate() {
		recalculating = true
		const res = await fetch(`/api/trips/${data.trip.id}/settlements`, { method: 'POST' })
		if (res.ok) {
			settlements = await res.json()
			const calculationRes = await fetch(`/api/trips/${data.trip.id}/settlements/calculate`)
			if (calculationRes.ok) {
				const calculation: Calculation = await calculationRes.json()
				calculatedBalances = calculation.balances
			}
			calculated = true
			toast.success('結算已重新計算')
		} else {
			toast.error('重新計算失敗，請稍後再試')
		}
		recalculating = false
	}

	async function toggleSettled(s: Settlement) {
		const res = await fetch(`/api/trips/${data.trip.id}/settlements/${s.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isSettled: !s.isSettled })
		})
		if (res.ok) {
			const updated = await res.json()
			const idx = settlements.findIndex((x) => x.id === s.id)
			if (idx >= 0) settlements[idx] = { ...settlements[idx], isSettled: updated.isSettled }
		} else {
			toast.error('更新結算狀態失敗，請稍後再試')
		}
	}

	onMount(() => {
		load()
		const frame = requestAnimationFrame(() => {
			chartsReady = true
		})
		return () => cancelAnimationFrame(frame)
	})
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<div
		class="flex flex-col gap-5 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">05 / 費用</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">共同花費</h2>
			<p class="mt-3 text-black/55">記錄每一筆支出，讓最後的分攤更清楚。</p>
		</div>
		<div class="flex gap-2">
			<Button
				variant="outline"
				class="h-11 rounded-none font-bold"
				disabled={recalculating}
				onclick={recalculate}
			>
				<RefreshCw class="size-4 {recalculating ? 'animate-spin' : ''}" />
				重新計算
			</Button>
			{#if data.trip.status !== 'completed'}
				<Button
					href={resolve(`/trips/${data.trip.id}/expenses/new`)}
					class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
				>
					<Plus class="size-4" /> 新增費用
				</Button>
			{/if}
		</div>
	</div>

	<!-- Stats -->
	<div class="mt-8 grid gap-3 sm:grid-cols-3">
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">總支出</p>
			<p class="mt-3 text-3xl font-black">{data.trip.currency} {total.toFixed(2)}</p>
		</div>
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">筆數</p>
			<p class="mt-3 text-3xl font-black">{bills.length}</p>
		</div>
		<div class="border border-black/10 bg-white p-4">
			<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">我的結餘</p>
			{#if myPendingBalance > 0.01}
				<p class="mt-3 text-2xl font-black text-green-700">
					待收 {data.trip.currency}
					{myPendingBalance.toFixed(2)}
				</p>
			{:else if myPendingBalance < -0.01}
				<p class="mt-3 text-2xl font-black text-red-600">
					待付 {data.trip.currency}
					{Math.abs(myPendingBalance).toFixed(2)}
				</p>
			{:else if calculated}
				<p class="mt-3 text-2xl font-black text-black/40">已結清</p>
			{:else}
				<p class="mt-3 text-xl font-black text-black/30">未計算</p>
			{/if}
		</div>
	</div>

	<!-- Statistics -->
	<section class="mt-8 border border-black/10 bg-white p-5 sm:p-8">
		<div
			class="flex flex-col gap-4 border-b border-black/10 pb-5 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">費用統計</p>
				<h3 class="mt-2 text-2xl font-black">支出分析</h3>
			</div>
			<div class="grid grid-cols-2 gap-2">
				<label class="grid gap-1 text-xs font-bold text-black/55"
					>開始日期
					<input
						type="date"
						bind:value={statsStart}
						class="h-9 border border-black/20 bg-[#fbfcf8] px-2"
					/>
				</label>
				<label class="grid gap-1 text-xs font-bold text-black/55"
					>結束日期
					<input
						type="date"
						bind:value={statsEnd}
						class="h-9 border border-black/20 bg-[#fbfcf8] px-2"
					/>
				</label>
			</div>
		</div>
		<div class="mt-5 grid gap-6 lg:grid-cols-2">
			<div>
				<div class="mb-3 flex items-center justify-between">
					<h4 class="font-bold">依類別</h4>
					<span class="font-mono text-xs text-black/45"
						>{data.trip.currency}
						{filteredBills.reduce((sum, bill) => sum + bill.amount, 0).toFixed(2)}</span
					>
				</div>
				{#if chartsReady && categoryChartData.length > 0}
					{#key categoryChartLabels.join('|') + ':' + categoryChartMax}
						<ChartContainer config={categoryChartConfig} class="h-56 w-full min-w-0">
							<Chart
								data={categoryChartData}
								x="label"
								y="amount"
								xDomain={categoryChartLabels}
								yDomain={[0, categoryChartMax]}
								yBaseline={0}
								bandPadding={0.35}
								padding={{ top: 12, right: 12, bottom: 32, left: 42 }}
							>
								<Layer type="svg">
									<Axis placement="left" grid tickMarks={false} />
									<Axis placement="bottom" tickMarks={false} />
									<Bars
										data={categoryChartData}
										x="label"
										y="amount"
										radius={4}
										fill="var(--chart-1)"
										tooltip
									/>
								</Layer>
							</Chart>
						</ChartContainer>
					{/key}
				{:else}<p class="text-sm text-black/40">沒有符合日期的費用。</p>{/if}
			</div>
		</div>
		<div class="mt-6 border-t border-black/10 pt-5">
			<h4 class="mb-3 font-bold">依日期</h4>
			{#if chartsReady && dailyChartData.length > 0}
				{#key dailyChartLabels.join('|') + ':' + dailyChartMax}
					<ChartContainer config={dailyChartConfig} class="h-56 w-full min-w-0">
						<Chart
							data={dailyChartData}
							x="label"
							y="amount"
							xDomain={dailyChartLabels}
							yDomain={[0, dailyChartMax]}
							yBaseline={0}
							bandPadding={0.25}
							padding={{ top: 12, right: 12, bottom: 32, left: 42 }}
						>
							<Layer type="svg">
								<Axis placement="left" grid tickMarks={false} />
								<Axis placement="bottom" tickMarks={false} />
								<Bars
									data={dailyChartData}
									x="label"
									y="amount"
									radius={4}
									fill="var(--chart-1)"
									tooltip
								/>
							</Layer>
						</Chart>
					</ChartContainer>
				{/key}
			{:else}<p class="text-sm text-black/40">沒有符合日期的費用。</p>{/if}
		</div>
	</section>

	<!-- Settlements -->
	{#if pendingSettlements.length > 0}
		<section class="mt-8">
			<p class="mb-3 font-mono text-[10px] font-bold tracking-widest text-black/40">轉帳明細</p>
			<div class="grid gap-4">
				{#each settlementGroups as group}
					<div>
						<p class="mb-2 text-sm font-bold">{group.title}</p>
						<div class="grid gap-2">
							{#each group.settlements as s (s.id)}
								{@const isMe = s.fromUserId === data.user.id || s.toUserId === data.user.id}
								<div
									class="flex flex-wrap items-center gap-3 border p-4 {isMe
										? 'border-black/25 bg-[#f6ffd6]'
										: 'border-black/10 bg-white'}"
								>
									<span class="min-w-0 flex-1">
										<span class="flex items-center gap-2 text-sm font-bold">
											<UserAvatar
												name={userName(s.fromUser)}
												image={s.fromUser.image}
												class="size-6 text-[10px]"
											/>
											<span class="truncate">{userName(s.fromUser)}</span>
											<ArrowRight class="size-3.5 shrink-0 text-black/40" />
											<UserAvatar
												name={userName(s.toUser)}
												image={s.toUser.image}
												class="size-6 text-[10px]"
											/>
											<span class="truncate">{userName(s.toUser)}</span>
										</span>
										{#if s.fromUserId === data.user.id}
											<span
												class="mt-0.5 block font-mono text-[10px] font-bold tracking-widest text-red-500"
												>我需要付</span
											>
										{:else if s.toUserId === data.user.id}
											<span
												class="mt-0.5 block font-mono text-[10px] font-bold tracking-widest text-green-700"
												>我會收到</span
											>
										{/if}
									</span>
									<span class="font-mono text-sm font-bold">
										{data.trip.currency}
										{s.amount.toFixed(2)}
									</span>
									<button
										type="button"
										onclick={() => toggleSettled(s)}
										class="h-8 shrink-0 border px-3 font-mono text-[10px] font-bold tracking-widest transition {s.isSettled
											? 'border-green-600 bg-green-50 text-green-700 hover:bg-green-100'
											: 'border-black/20 bg-white text-black/40 hover:border-black/40 hover:text-black/70'}"
									>
										{s.isSettled ? '已付清' : '標記付清'}
									</button>
									{#if s.details && s.details.length > 0}
										<div
											class="mt-2 basis-full border-t border-black/10 pt-2 text-xs text-black/55"
										>
											<span class="font-bold">原因：</span>
											{#each s.details as detail, index}
												{#if index > 0}、{/if}
												{detail.billTitle}／{detail.itemName}
												{data.trip.currency}{detail.amount.toFixed(2)}
											{/each}
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Bills -->
	<section class="mt-8">
		{#if settlements.length > 0}
			<p class="mb-3 font-mono text-[10px] font-bold tracking-widest text-black/40">費用紀錄</p>
		{/if}
		<div class="grid gap-2">
			{#each bills as bill (bill.id)}
				{@const settledTransfers = settlements.filter(
					(settlement) => settlement.isSettled && settlement.billId === bill.id
				)}
				<a
					href={resolve(`/trips/${data.trip.id}/expenses/${bill.id}`)}
					class="flex flex-wrap items-center gap-4 border border-black/10 bg-white p-4 transition hover:border-black/30"
				>
					<span class="grid size-10 place-items-center bg-[#eef0eb]">
						<CircleDollarSign class="size-5 text-[#779a00]" />
					</span>
					<span class="min-w-0 flex-1">
						<span class="block truncate font-bold">{bill.title}</span>
						<span class="mt-1 block text-xs text-black/45">
							{bill.date}{bill.category ? ` · ${bill.category}` : ''}
						</span>
					</span>
					<span class="font-mono font-bold">{bill.currency} {bill.amount.toFixed(2)}</span>
					{#if settledTransfers.length > 0}
						<div class="basis-full border-t border-black/10 pt-2 text-xs text-green-700">
							<div>
								已付清：{#each settledTransfers as transfer, index}{#if index > 0}、{/if}{userName(
										transfer.fromUser
									)} → {userName(transfer.toUser)}
									{bill.currency}{transfer.amount.toFixed(2)}{/each}
							</div>
							{#each settledTransfers as transfer (transfer.id)}
								<button
									type="button"
									class="mt-1 font-bold underline hover:text-black"
									onclick={(event) => {
										event.preventDefault()
										event.stopPropagation()
										toggleSettled(transfer)
									}}
								>
									Undo {userName(transfer.fromUser)} → {userName(transfer.toUser)}
								</button>
							{/each}
						</div>
					{/if}
				</a>
			{/each}
			{#if bills.length === 0}
				<div class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50">
					還沒有費用紀錄。
				</div>
			{/if}
		</div>
	</section>
</main>
