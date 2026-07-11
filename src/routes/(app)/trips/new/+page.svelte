<script lang="ts">
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'
	import { Textarea } from '$lib/components/ui/textarea'
	import { RangeCalendar } from '$lib/components/ui/range-calendar'
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select'
	import { parseDate, type CalendarDate } from '@internationalized/date'
	import { ArrowLeft, CalendarDays, CircleDollarSign, MapPin, Plane } from '@lucide/svelte'
	import type { ActionData } from './$types'

	let { form }: { form: ActionData } = $props()

	const currencyOptions = ['TWD', 'JPY', 'USD', 'EUR', 'KRW', 'THB']
	type TripDateRange = { start: CalendarDate; end: CalendarDate }
	let dateRange = $state<TripDateRange | undefined>(getInitialDateRange())
	let selectedCurrency = $state('TWD')

	$effect(() => {
		const currency = form?.values?.currency
		if (currency) selectedCurrency = currency
	})

	function getInitialDateRange(): TripDateRange | undefined {
		const start = form?.values?.startDate
		const end = form?.values?.endDate
		if (!start && !end) return undefined

		return {
			start: parseDate(start || end || new Date().toISOString().slice(0, 10)),
			end: parseDate(end || start || new Date().toISOString().slice(0, 10))
		}
	}
</script>

<svelte:head>
	<title>新增旅程 | PackSync</title>
	<meta name="description" content="建立新的 PackSync 旅程。" />
</svelte:head>

<main class="min-h-screen bg-[#f4f5f2] text-[#151817]">
	<section
		class="mx-auto grid w-full max-w-6xl gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-12"
	>
		<aside class="border-b border-black/10 pb-8 lg:border-r lg:border-b-0 lg:pr-10">
			<Button href="/trips" variant="ghost" class="mb-8 h-9 px-0 font-bold hover:bg-transparent">
				<ArrowLeft class="size-4" />
				返回旅程
			</Button>

			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">新增 / 旅程</p>
			<h1 class="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-6xl">建立旅程</h1>
			<p class="mt-4 max-w-md text-base leading-7 text-black/55">
				先設定旅程基本資料。建立後，你可以繼續加入成員、行李清單、費用與行程細節。
			</p>

			<div class="mt-10 grid gap-3 text-sm text-black/60">
				<p class="flex items-center gap-3 border border-black/10 bg-white p-3">
					<Plane class="size-4 text-black/35" />
					共同規劃空間
				</p>
				<p class="flex items-center gap-3 border border-black/10 bg-white p-3">
					<CalendarDays class="size-4 text-black/35" />
					旅程日期與功能
				</p>
				<p class="flex items-center gap-3 border border-black/10 bg-white p-3">
					<CircleDollarSign class="size-4 text-black/35" />
					預設費用幣別
				</p>
			</div>
		</aside>

		<form method="POST" class="grid gap-6 border border-black/10 bg-white p-5 sm:p-7">
			{#if form?.message}
				<p class="border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
					{form.message}
				</p>
			{/if}

			<div class="grid gap-2">
				<label for="name" class="text-sm font-bold"
					>旅程名稱 <span class="text-[#779a00]">必填</span></label
				>
				<Input
					id="name"
					name="name"
					placeholder="例如：東京春季旅行"
					value={form?.values?.name ?? ''}
					required
					class="h-11 rounded-none border-black/20 bg-[#fbfcf8]"
				/>
			</div>

			<div class="grid gap-2">
				<label for="destination" class="text-sm font-bold">目的地</label>
				<div class="relative">
					<MapPin
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-black/35"
					/>
					<Input
						id="destination"
						name="destination"
						placeholder="例如：日本東京"
						value={form?.values?.destination ?? ''}
						class="h-11 rounded-none border-black/20 bg-[#fbfcf8] pl-9"
					/>
				</div>
			</div>

			<div class="grid gap-3">
				<div class="flex items-end justify-between gap-4">
					<div>
						<p class="text-sm font-bold">旅程日期</p>
						<p class="mt-1 text-xs text-black/45">選擇開始與結束日期，可稍後再修改。</p>
					</div>
					<CalendarDays class="size-5 text-[#779a00]" />
				</div>
				<div class="overflow-x-auto border border-black/15 bg-[#fbfcf8] p-1">
					<RangeCalendar bind:value={dateRange} locale="zh-TW" class="mx-auto" />
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="border border-black/10 bg-[#eef0eb] px-3 py-2">
						<p class="font-mono text-[10px] font-bold tracking-[0.12em] text-black/40">開始日期</p>
						<p class="mt-1 text-sm font-bold">{dateRange?.start?.toString() ?? '尚未選擇'}</p>
					</div>
					<div class="border border-black/10 bg-[#eef0eb] px-3 py-2">
						<p class="font-mono text-[10px] font-bold tracking-[0.12em] text-black/40">結束日期</p>
						<p class="mt-1 text-sm font-bold">{dateRange?.end?.toString() ?? '尚未選擇'}</p>
					</div>
				</div>
				<input type="hidden" name="startDate" value={dateRange?.start?.toString() ?? ''} />
				<input type="hidden" name="endDate" value={dateRange?.end?.toString() ?? ''} />
			</div>

			<div class="grid gap-2">
				<label for="currency" class="text-sm font-bold">預設幣別</label>
				<Select type="single" name="currency" bind:value={selectedCurrency}>
					<SelectTrigger
						id="currency"
						class="h-11 w-full rounded-none border-black/20 bg-[#fbfcf8] px-3 text-sm shadow-none focus-visible:ring-black/10"
					>
						<span>{selectedCurrency}</span>
					</SelectTrigger>
					<SelectContent class="rounded-none border-black/15 bg-white">
						{#each currencyOptions as currency (currency)}
							<SelectItem value={currency}>
								{currency}
							</SelectItem>
						{/each}
					</SelectContent>
				</Select>
			</div>

			<div class="grid gap-2">
				<label for="description" class="text-sm font-bold">備註</label>
				<Textarea
					id="description"
					name="description"
					placeholder="例如：團體目標、住宿備註、需要提前預訂的項目⋯"
					value={form?.values?.description ?? ''}
					class="min-h-28 rounded-none border-black/20 bg-[#fbfcf8]"
				/>
			</div>

			<div
				class="flex flex-col-reverse gap-3 border-t border-black/10 pt-5 sm:flex-row sm:justify-end"
			>
				<Button
					href="/trips"
					variant="outline"
					class="h-11 rounded-none border-black/20 px-5 font-bold"
				>
					取消
				</Button>
				<Button
					type="submit"
					class="h-11 rounded-none bg-[#d8ff36] px-5 font-bold text-black hover:bg-[#c8ef28]"
				>
					建立旅程
				</Button>
			</div>
		</form>
	</section>
</main>
