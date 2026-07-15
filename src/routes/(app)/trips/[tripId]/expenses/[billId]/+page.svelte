<script lang="ts">
	import { ArrowLeft, Pencil, Trash2 } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import UserAvatar from '$lib/components/user-avatar.svelte'
	import { confirmDialog } from '$lib/stores/confirm'
	import { toast } from '$lib/stores/toast'
	import type { PageData } from './$types'

	let { data, params }: { data: PageData; params: { billId: string } } = $props()

	type BillUser = { id: string; name: string; email: string; image: string | null }
	type BillPayer = { id: string; userId: string; amount: number; user: BillUser }
	type BillParticipant = { id: string; userId: string; value: number | null; user: BillUser }
	type BillItem = {
		id: string
		name: string
		amount: number
		notes: string | null
		participants: string | null // JSON array of userIds
	}
	type Bill = {
		id: string
		title: string
		amount: number
		currency: string
		category: string | null
		date: string
		splitMethod: string
		notes: string | null
		payers: BillPayer[]
		participants: BillParticipant[]
		items: BillItem[]
	}

	const SPLIT_LABELS: Record<string, string> = {
		equal: '平均分攤',
		percentage: '按百分比',
		fixed: '固定金額'
	}

	let bill = $state<Bill | null>(null)

	let isItemized = $derived(
		!!bill && bill.items.length > 0 && bill.items.some((i) => i.participants !== null)
	)

	// userId → display name built from payers + participants on the bill
	let userNameMap = $derived.by((): Record<string, string> => {
		if (!bill) return {}
		const map: Record<string, string> = {}
		for (const p of bill.payers) map[p.userId] = p.user.name || p.user.email
		for (const p of bill.participants) map[p.userId] = p.user.name || p.user.email
		return map
	})

	let perPerson = $derived.by(() => {
		if (!bill) return {} as Record<string, number>
		const result: Record<string, number> = {}
		const participants = bill.participants
		switch (bill.splitMethod) {
			case 'equal': {
				const per = bill.amount / participants.length
				for (const p of participants) result[p.userId] = per
				break
			}
			case 'percentage': {
				for (const p of participants) {
					result[p.userId] = bill.amount * ((p.value ?? 0) / 100)
				}
				break
			}
			case 'fixed': {
				for (const p of participants) {
					result[p.userId] = p.value ?? 0
				}
				break
			}
		}
		return result
	})

	function userName(u: BillUser) {
		return u.name || u.email
	}

	function itemParticipantIds(item: BillItem): string[] {
		if (!item.participants) return []
		try {
			return JSON.parse(item.participants) as string[]
		} catch {
			return []
		}
	}

	function splitValueLabel(method: string, value: number | null): string {
		if (value === null || method === 'fixed') return ''
		if (method === 'percentage') return `${value}%`
		return ''
	}

	async function load() {
		const res = await fetch(`/api/trips/${data.trip.id}/bills/${params.billId}`)
		if (res.ok) bill = await res.json()
	}

	async function remove() {
		const ok = await confirmDialog({
			title: '刪除費用',
			message: `確定要刪除「${bill?.title ?? '這筆費用'}」嗎？相關的分帳與結算也會重新計算。`,
			confirmLabel: '刪除',
			danger: true
		})
		if (!ok) return
		const res = await fetch(`/api/trips/${data.trip.id}/bills/${params.billId}`, {
			method: 'DELETE'
		})
		if (res.ok) {
			location.href = `/trips/${data.trip.id}/expenses`
		} else {
			toast.error('刪除失敗，請稍後再試')
		}
	}

	onMount(load)
</script>

<main class="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8 lg:py-12">
	<Button
		href={`/trips/${data.trip.id}/expenses`}
		variant="ghost"
		class="mb-8 h-9 rounded-none px-0 font-bold hover:bg-transparent"
	>
		<ArrowLeft class="size-4" /> 返回費用
	</Button>

	{#if !bill}
		<div class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50">
			載入費用中…
		</div>
	{:else}
		<article class="grid gap-4">
			<!-- Header -->
			<div class="border border-black/10 bg-white p-6 sm:p-8">
				<div class="flex items-start justify-between gap-4">
					<div>
						<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">
							費用明細 / {bill.date}
						</p>
						<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">{bill.title}</h2>
						{#if bill.category}
							<span
								class="mt-3 inline-block border border-black/15 px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-black/50"
							>
								{bill.category}
							</span>
						{/if}
					</div>
					<div class="text-right">
						<p class="font-mono text-2xl font-black">
							{bill.currency}
							{bill.amount.toFixed(2)}
						</p>
						<p class="mt-1 font-mono text-xs text-black/40">
							{isItemized ? '逐項分攤' : SPLIT_LABELS[bill.splitMethod]}
						</p>
					</div>
				</div>
				{#if bill.notes}
					<p class="mt-5 border-t border-black/10 pt-5 leading-7 text-black/60">{bill.notes}</p>
				{/if}
			</div>

			<!-- Items (if any) -->
			{#if bill.items.length > 0}
				<div class="border border-black/10 bg-white p-5 sm:p-8">
					<p class="mb-4 font-mono text-[10px] font-bold tracking-widest text-black/40">消費明細</p>
					<div class="grid gap-3">
						{#each bill.items as item (item.id)}
							{@const ids = itemParticipantIds(item)}
							<div class="border-b border-black/8 pb-3 last:border-0">
								<div class="flex items-center gap-3">
									<span class="flex-1 text-sm font-bold">{item.name}</span>
									<span class="font-mono text-sm font-bold">
										{bill.currency}
										{item.amount.toFixed(2)}
									</span>
								</div>
								{#if ids.length > 0}
									<div class="mt-1.5 flex flex-wrap gap-1">
										{#each ids as uid (uid)}
											<span
												class="border border-black/15 px-1.5 py-0.5 font-mono text-[10px] text-black/50"
											>
												{userNameMap[uid] ?? uid}
											</span>
										{/each}
										<span class="font-mono text-[10px] text-black/35">
											各付 {bill.currency}{(item.amount / ids.length).toFixed(2)}
										</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Payers -->
			<div class="border border-black/10 bg-white p-5 sm:p-8">
				<p class="mb-4 font-mono text-[10px] font-bold tracking-widest text-black/40">付款人</p>
				<div class="grid gap-2">
					{#each bill.payers as payer (payer.id)}
						<div class="flex items-center gap-3">
							<UserAvatar
								name={userName(payer.user)}
								image={payer.user.image}
								class="size-8 text-xs"
							/>
							<span class="flex-1 text-sm font-bold">{userName(payer.user)}</span>
							<span class="font-mono text-sm font-bold">
								{bill.currency}
								{payer.amount.toFixed(2)}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Participants & Split -->
			<div class="border border-black/10 bg-white p-5 sm:p-8">
				<div class="mb-4 flex items-center justify-between">
					<p class="font-mono text-[10px] font-bold tracking-widest text-black/40">分攤明細</p>
					<span
						class="border border-black/15 px-2 py-0.5 font-mono text-[10px] font-bold text-black/50"
					>
						{isItemized ? '逐項分攤' : SPLIT_LABELS[bill.splitMethod]}
					</span>
				</div>
				<div class="grid gap-2">
					{#each bill.participants as p (p.id)}
						<div class="flex items-center gap-3">
							<UserAvatar name={userName(p.user)} image={p.user.image} class="size-8 text-xs" />
							<span class="flex-1 text-sm font-bold">{userName(p.user)}</span>
							{#if bill.splitMethod !== 'equal' && p.value !== null}
								<span class="font-mono text-xs text-black/40">
									{splitValueLabel(bill.splitMethod, p.value)}
								</span>
							{/if}
							<span class="w-28 text-right font-mono text-sm font-bold">
								{bill.currency}
								{(perPerson[p.userId] ?? 0).toFixed(2)}
							</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- Actions -->
			{#if data.trip.status !== 'completed'}
				<div class="border border-black/10 bg-white p-5 sm:p-8">
					<Button
						href={`/trips/${data.trip.id}/expenses/new?edit=${bill.id}`}
						variant="outline"
						class="mr-2 rounded-none font-bold"
					>
						<Pencil class="size-4" /> 編輯費用
					</Button>
					<Button
						type="button"
						variant="outline"
						class="rounded-none border-red-200 font-bold text-red-600 hover:bg-red-50"
						onclick={remove}
					>
						<Trash2 class="size-4" /> 刪除費用
					</Button>
				</div>
			{/if}
		</article>
	{/if}
</main>
