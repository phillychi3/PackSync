<script lang="ts">
	import { ArrowLeft, Plus, Trash2 } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import UserAvatar from '$lib/components/user-avatar.svelte'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()

	type TripMember = { userId: string; name: string; email: string; image: string | null }
	type BillItem = { name: string; amount: string; participantIds: string[] }

	const CATEGORIES = ['餐飲', '交通', '住宿', '娛樂', '購物', '其他'] as const
	const SPLIT_METHODS = [
		{ value: 'equal', label: '平均分攤' },
		{ value: 'percentage', label: '按百分比' },
		{ value: 'fixed', label: '固定金額' }
	] as const

	let members = $state<TripMember[]>([])
	let loading = $state(true)
	let submitting = $state(false)
	let message = $state('')
	let editingBillId = $state<string | null>(null)

	let title = $state('')
	let date = $state(new Date().toISOString().slice(0, 10))
	let category = $state('')
	let notes = $state('')
	let splitMethod = $state<'equal' | 'percentage' | 'fixed'>('equal')

	let useItems = $state(false)
	let directAmount = $state('')
	let items = $state<BillItem[]>([])

	let payerEnabled = $state<Record<string, boolean>>({})
	let payerAmount = $state<Record<string, string>>({})
	let participantEnabled = $state<Record<string, boolean>>({})
	let participantValue = $state<Record<string, string>>({})

	let itemsTotal = $derived(items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0))
	let totalAmount = $derived(useItems ? itemsTotal : parseFloat(directAmount) || 0)

	let activePayers = $derived(
		Object.entries(payerEnabled)
			.filter(([, v]) => v)
			.map(([uid]) => uid)
	)
	let activeParticipants = $derived(
		Object.entries(participantEnabled)
			.filter(([, v]) => v)
			.map(([uid]) => uid)
	)

	let payerTotal = $derived(
		activePayers.reduce((s, uid) => s + (parseFloat(payerAmount[uid]) || 0), 0)
	)

	let percentageTotal = $derived(
		activeParticipants.reduce((s, uid) => s + (parseFloat(participantValue[uid]) || 0), 0)
	)

	let fixedTotal = $derived(
		activeParticipants.reduce((s, uid) => s + (parseFloat(participantValue[uid]) || 0), 0)
	)

	let perPerson = $derived.by(() => {
		const result: Record<string, number> = {}
		if (activeParticipants.length === 0 || totalAmount === 0) return result
		switch (splitMethod) {
			case 'equal': {
				const per = totalAmount / activeParticipants.length
				for (const uid of activeParticipants) result[uid] = per
				break
			}
			case 'percentage': {
				for (const uid of activeParticipants) {
					result[uid] = totalAmount * ((parseFloat(participantValue[uid]) || 0) / 100)
				}
				break
			}
			case 'fixed': {
				for (const uid of activeParticipants) {
					result[uid] = parseFloat(participantValue[uid]) || 0
				}
				break
			}
		}
		return result
	})

	// Per-person totals derived from itemized participants
	let itemizedPerPerson = $derived.by(() => {
		const result: Record<string, number> = {}
		for (const item of items) {
			const amount = parseFloat(item.amount) || 0
			if (amount <= 0 || item.participantIds.length === 0) continue
			const share = amount / item.participantIds.length
			for (const uid of item.participantIds) {
				result[uid] = (result[uid] ?? 0) + share
			}
		}
		return result
	})

	$effect(() => {
		const total = totalAmount
		if (total <= 0 || activePayers.length !== 1) return
		const userId = activePayers[0]
		payerAmount[userId] = total.toFixed(2)
	})

	function memberLabel(m: TripMember) {
		return m.name || m.email
	}

	function allMemberIds() {
		return members.map((m) => m.userId)
	}

	onMount(async () => {
		const res = await fetch(`/api/trips/${data.trip.id}/members`)
		if (res.ok) {
			members = await res.json()
			const enabled: Record<string, boolean> = {}
			const amounts: Record<string, string> = {}
			const values: Record<string, string> = {}
			for (const m of members) {
				enabled[m.userId] = m.userId === data.user.id
				amounts[m.userId] = ''
				values[m.userId] = ''
			}
			payerEnabled = enabled
			participantEnabled = { ...enabled }
			payerAmount = amounts
			participantValue = values
			items = [{ name: '', amount: '', participantIds: allMemberIds() }]

			const editId = new URLSearchParams(location.search).get('edit')
			if (editId) {
				const billRes = await fetch(`/api/trips/${data.trip.id}/bills/${editId}`)
				if (billRes.ok) {
					const bill = await billRes.json()
					editingBillId = editId
					title = bill.title
					date = bill.date
					category = bill.category ?? ''
					notes = bill.notes ?? ''
					splitMethod = bill.splitMethod
					useItems = bill.items.length > 0
					directAmount = String(bill.amount)
					payerEnabled = Object.fromEntries(members.map((m) => [m.userId, false]))
					payerAmount = { ...amounts }
					for (const payer of bill.payers) {
						payerEnabled[payer.userId] = true
						payerAmount[payer.userId] = String(payer.amount)
					}
					participantEnabled = Object.fromEntries(members.map((m) => [m.userId, false]))
					participantValue = { ...values }
					for (const participant of bill.participants) {
						participantEnabled[participant.userId] = true
						participantValue[participant.userId] =
							participant.value === null ? '' : String(participant.value)
					}
					items = bill.items.map(
						(item: { name: string; amount: number; participants: string | null }) => ({
							name: item.name,
							amount: String(item.amount),
							participantIds: item.participants ? JSON.parse(item.participants) : allMemberIds()
						})
					)
				}
			}
		}
		loading = false
	})

	function addItem() {
		items = [...items, { name: '', amount: '', participantIds: allMemberIds() }]
	}

	function removeItem(i: number) {
		items = items.filter((_, idx) => idx !== i)
	}

	function toggleItemParticipant(itemIdx: number, userId: string) {
		const ids = items[itemIdx].participantIds
		const idx = ids.indexOf(userId)
		if (idx >= 0) {
			ids.splice(idx, 1)
		} else {
			ids.push(userId)
		}
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault()
		message = ''

		if (totalAmount <= 0) {
			message = '請輸入有效金額。'
			return
		}
		if (activePayers.length === 0) {
			message = '請至少選擇一位付款人。'
			return
		}
		if (Math.abs(payerTotal - totalAmount) > 0.01) {
			message = `付款人合計 ${payerTotal.toFixed(2)} 必須等於總金額 ${totalAmount.toFixed(2)}`
			return
		}

		if (useItems) {
			const validItems = items.filter((i) => i.name.trim() && parseFloat(i.amount) > 0)
			if (validItems.length === 0) {
				message = '請至少新增一個有效項目。'
				return
			}
			if (validItems.some((i) => i.participantIds.length === 0)) {
				message = '每個項目至少需要一位參與者。'
				return
			}
		} else {
			if (activeParticipants.length === 0) {
				message = '請至少選擇一位參與者。'
				return
			}
			if (splitMethod === 'percentage' && Math.abs(percentageTotal - 100) > 0.01) {
				message = `百分比合計為 ${percentageTotal.toFixed(1)}%，需等於 100%。`
				return
			}
			if (splitMethod === 'fixed' && Math.abs(fixedTotal - totalAmount) > 0.01) {
				message = `固定金額合計 ${fixedTotal.toFixed(2)} 需等於帳單金額 ${totalAmount.toFixed(2)}。`
				return
			}
		}

		const payers = activePayers.map((uid) => ({
			userId: uid,
			amount: parseFloat(payerAmount[uid]) || 0
		}))

		let participants: { userId: string; value: number | null }[]
		let resolvedSplitMethod: string
		let billItems: { name: string; amount: number; participants: string[] }[]

		if (useItems) {
			billItems = items
				.filter((i) => i.name.trim() && parseFloat(i.amount) > 0)
				.map((i) => ({
					name: i.name.trim(),
					amount: parseFloat(i.amount),
					participants: i.participantIds
				}))
			participants = Object.entries(itemizedPerPerson).map(([uid, value]) => ({
				userId: uid,
				value
			}))
			resolvedSplitMethod = 'fixed'
		} else {
			billItems = []
			participants = activeParticipants.map((uid) => ({
				userId: uid,
				value: splitMethod !== 'equal' ? parseFloat(participantValue[uid]) || null : null
			}))
			resolvedSplitMethod = splitMethod
		}

		submitting = true
		const res = await fetch(
			editingBillId
				? `/api/trips/${data.trip.id}/bills/${editingBillId}`
				: `/api/trips/${data.trip.id}/bills`,
			{
				method: editingBillId ? 'PUT' : 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					title,
					amount: totalAmount,
					currency: data.trip.currency,
					category: category || null,
					date,
					splitMethod: resolvedSplitMethod,
					notes: notes || null,
					payers,
					participants,
					items: billItems
				})
			}
		)

		if (res.ok) {
			location.href = `/trips/${data.trip.id}/expenses`
		} else {
			message = '儲存失敗，請確認所有欄位。'
			submitting = false
		}
	}
</script>

<main class="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
	<Button
		href={`/trips/${data.trip.id}/expenses`}
		variant="ghost"
		class="mb-8 h-9 rounded-none px-0 font-bold hover:bg-transparent"
	>
		<ArrowLeft class="size-4" /> 返回費用
	</Button>
	<div class="border-b border-black/15 pb-6">
		<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">新增 / 費用</p>
		<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">記錄一筆費用</h2>
	</div>

	{#if loading}
		<div class="mt-8 border border-dashed border-black/20 bg-white p-10 text-center text-black/50">
			載入成員資料中…
		</div>
	{:else}
		<form class="mt-8 grid gap-4" onsubmit={submit}>
			{#if message}
				<p class="bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
			{/if}

			<!-- Section 1: Basic Info -->
			<section class="border border-black/10 bg-white p-5 sm:p-8">
				<p class="mb-4 font-mono text-[10px] font-bold tracking-widest text-black/40">
					01 / 基本資訊
				</p>
				<div class="grid gap-4">
					<label class="grid gap-2 text-sm font-bold">
						費用名稱
						<Input
							bind:value={title}
							placeholder="例如：晚餐、計程車、住宿"
							required
							class="rounded-none border-black/20 bg-[#fbfcf8]"
						/>
					</label>
					<div class="grid gap-4 sm:grid-cols-2">
						<label class="grid gap-2 text-sm font-bold">
							日期
							<Input
								type="date"
								bind:value={date}
								required
								class="rounded-none border-black/20 bg-[#fbfcf8]"
							/>
						</label>
						<label class="grid gap-2 text-sm font-bold">
							分類
							<select
								bind:value={category}
								class="h-9 rounded-none border border-black/20 bg-[#fbfcf8] px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#d8ff36]"
							>
								<option value="">不指定</option>
								{#each CATEGORIES as c (c)}
									<option value={c}>{c}</option>
								{/each}
							</select>
						</label>
					</div>
					<label class="grid gap-2 text-sm font-bold">
						備註
						<Textarea
							bind:value={notes}
							placeholder="附加說明（選填）"
							class="rounded-none border-black/20 bg-[#fbfcf8]"
						/>
					</label>
				</div>
			</section>

			<!-- Section 2: Amount / Items -->
			<section class="border border-black/10 bg-white p-5 sm:p-8">
				<div class="mb-4 flex items-center justify-between">
					<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">02 / 金額</p>
					<label class="flex cursor-pointer items-center gap-2 text-sm font-bold">
						<input type="checkbox" bind:checked={useItems} class="accent-[#d8ff36]" />
						逐項輸入
					</label>
				</div>

				{#if !useItems}
					<label class="grid gap-2 text-sm font-bold">
						總金額 ({data.trip.currency})
						<Input
							type="number"
							min="0.01"
							step="0.01"
							bind:value={directAmount}
							placeholder="0.00"
							class="rounded-none border-black/20 bg-[#fbfcf8]"
						/>
					</label>
				{:else}
					<div class="grid gap-3">
						{#each items as item, i (i)}
							<div class="border border-black/10 bg-[#fbfcf8] p-3">
								<div class="flex items-center gap-2">
									<Input
										bind:value={item.name}
										placeholder="項目名稱"
										class="flex-1 rounded-none border-black/20 bg-white"
									/>
									<Input
										type="number"
										min="0"
										step="0.01"
										bind:value={item.amount}
										placeholder="0.00"
										class="w-28 rounded-none border-black/20 bg-white"
									/>
									<button
										type="button"
										onclick={() => removeItem(i)}
										class="grid size-9 shrink-0 place-items-center border border-black/10 bg-white hover:border-red-200 hover:bg-red-50"
									>
										<Trash2 class="size-4 text-black/40" />
									</button>
								</div>
								<!-- Per-item participant selection -->
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each members as m (m.userId)}
										<button
											type="button"
											onclick={() => toggleItemParticipant(i, m.userId)}
											class="border px-2 py-0.5 font-mono text-[11px] font-bold transition {item.participantIds.includes(
												m.userId
											)
												? 'border-black bg-[#d8ff36] text-black'
												: 'border-black/20 bg-white text-black/40 hover:border-black/40'}"
										>
											{memberLabel(m)}
										</button>
									{/each}
								</div>
							</div>
						{/each}
						<button
							type="button"
							onclick={addItem}
							class="flex h-9 items-center gap-2 border border-dashed border-black/20 px-3 text-sm text-black/50 hover:border-black/40 hover:text-black/70"
						>
							<Plus class="size-4" /> 新增項目
						</button>
					</div>

					<!-- Itemized per-person summary -->
					{#if itemsTotal > 0 && Object.keys(itemizedPerPerson).length > 0}
						<div class="mt-4 border-t border-black/10 pt-4">
							<p class="mb-2 font-mono text-[10px] font-bold tracking-widest text-black/40">
								每人小計
							</p>
							<div class="grid gap-1">
								{#each members.filter((m) => itemizedPerPerson[m.userId] > 0) as m (m.userId)}
									<div class="flex justify-between text-sm">
										<span class="text-black/70">{memberLabel(m)}</span>
										<span class="font-mono font-bold">
											{data.trip.currency}
											{(itemizedPerPerson[m.userId] ?? 0).toFixed(2)}
										</span>
									</div>
								{/each}
							</div>
							<div class="mt-2 flex justify-between border-t border-black/10 pt-2">
								<span class="text-sm text-black/50">合計</span>
								<span class="font-mono font-bold">{data.trip.currency} {itemsTotal.toFixed(2)}</span
								>
							</div>
						</div>
					{/if}
				{/if}
			</section>

			<!-- Section 3: Payers -->
			<section class="border border-black/10 bg-white p-5 sm:p-8">
				<p class="mb-1 font-mono text-[10px] font-bold tracking-widest text-black/40">
					03 / 付款人
				</p>
				<p class="mb-4 text-xs text-black/45">實際出錢的成員，可多人共同付款</p>
				<div class="grid gap-2">
					{#each members as m (m.userId)}
						<div class="flex items-center gap-3">
							<input
								type="checkbox"
								id="payer-{m.userId}"
								bind:checked={payerEnabled[m.userId]}
								class="size-4 accent-[#d8ff36]"
							/>
							<UserAvatar name={memberLabel(m)} image={m.image} class="size-6 text-[10px]" />
							<label for="payer-{m.userId}" class="flex-1 cursor-pointer text-sm font-bold">
								{memberLabel(m)}
								{#if m.userId === data.user.id}
									<span class="ml-1 font-mono text-[10px] text-black/40">（我）</span>
								{/if}
							</label>
							<div class="w-28 shrink-0 {payerEnabled[m.userId] ? '' : 'invisible'}">
								<Input
									type="number"
									min="0"
									step="0.01"
									bind:value={payerAmount[m.userId]}
									placeholder="金額"
									class="w-full rounded-none border-black/20 bg-[#fbfcf8]"
								/>
							</div>
						</div>
					{/each}
				</div>
				{#if totalAmount > 0}
					<div class="mt-4 flex justify-between border-t border-black/10 pt-3 text-xs">
						<span class="text-black/50">已分配付款</span>
						<span
							class="font-mono font-bold {Math.abs(payerTotal - totalAmount) < 0.01
								? 'text-green-700'
								: payerTotal > 0
									? 'text-red-500'
									: 'text-black/50'}"
						>
							{data.trip.currency}
							{payerTotal.toFixed(2)} / {totalAmount.toFixed(2)}
						</span>
					</div>
				{/if}
			</section>

			<!-- Sections 04 + 05: only shown when NOT using itemized mode -->
			{#if !useItems}
				<section class="border border-black/10 bg-white p-5 sm:p-8">
					<p class="mb-4 font-mono text-[10px] font-bold tracking-widest text-black/40">
						04 / 分攤方式
					</p>
					<div class="grid grid-cols-3 gap-2">
						{#each SPLIT_METHODS as m (m.value)}
							<label
								class="cursor-pointer border p-3 text-center text-sm font-bold transition {splitMethod ===
								m.value
									? 'border-black bg-[#d8ff36]'
									: 'border-black/15 bg-white hover:border-black/40'}"
							>
								<input
									type="radio"
									name="splitMethod"
									value={m.value}
									bind:group={splitMethod}
									class="sr-only"
								/>
								{m.label}
							</label>
						{/each}
					</div>

					<p class="mb-1 mt-6 font-mono text-[10px] font-bold tracking-widest text-black/40">
						05 / 參與者
					</p>
					<p class="mb-4 text-xs text-black/45">需要分攤費用的成員</p>
					<div class="grid gap-2">
						{#each members as m (m.userId)}
							<div class="flex items-center gap-3">
								<input
									type="checkbox"
									id="participant-{m.userId}"
									bind:checked={participantEnabled[m.userId]}
									class="size-4 accent-[#d8ff36]"
								/>
								<UserAvatar name={memberLabel(m)} image={m.image} class="size-6 text-[10px]" />
								<label for="participant-{m.userId}" class="flex-1 cursor-pointer text-sm font-bold">
									{memberLabel(m)}
									{#if m.userId === data.user.id}
										<span class="ml-1 font-mono text-[10px] text-black/40">（我）</span>
									{/if}
								</label>
								{#if splitMethod !== 'equal'}
									<div class="w-20 shrink-0 {participantEnabled[m.userId] ? '' : 'invisible'}">
										<Input
											type="number"
											min="0"
											step={splitMethod === 'percentage' ? '0.1' : '0.01'}
											bind:value={participantValue[m.userId]}
											placeholder={splitMethod === 'percentage' ? '%' : '金額'}
											class="w-full rounded-none border-black/20 bg-[#fbfcf8]"
										/>
									</div>
								{/if}
								<span
									class="w-24 shrink-0 text-right font-mono text-sm font-bold {participantEnabled[
										m.userId
									] && totalAmount > 0
										? ''
										: 'invisible'}"
								>
									{data.trip.currency}
									{(perPerson[m.userId] ?? 0).toFixed(2)}
								</span>
							</div>
						{/each}
					</div>

					{#if splitMethod === 'percentage' && activeParticipants.length > 0}
						<div class="mt-4 flex justify-between border-t border-black/10 pt-3 text-xs">
							<span class="text-black/50">百分比合計</span>
							<span
								class="font-mono font-bold {Math.abs(percentageTotal - 100) < 0.01
									? 'text-green-700'
									: percentageTotal > 0
										? 'text-red-500'
										: 'text-black/50'}"
							>
								{percentageTotal.toFixed(1)}%
							</span>
						</div>
					{:else if splitMethod === 'fixed' && activeParticipants.length > 0 && totalAmount > 0}
						<div class="mt-4 flex justify-between border-t border-black/10 pt-3 text-xs">
							<span class="text-black/50">已分配金額</span>
							<span
								class="font-mono font-bold {Math.abs(fixedTotal - totalAmount) < 0.01
									? 'text-green-700'
									: fixedTotal > 0
										? 'text-red-500'
										: 'text-black/50'}"
							>
								{data.trip.currency}
								{fixedTotal.toFixed(2)} / {totalAmount.toFixed(2)}
							</span>
						</div>
					{/if}
				</section>
			{/if}

			<Button
				type="submit"
				disabled={submitting}
				class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28] disabled:opacity-50"
			>
				{submitting ? '儲存中…' : '儲存費用'}
			</Button>
		</form>
	{/if}
</main>
