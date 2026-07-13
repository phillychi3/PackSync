<script lang="ts">
	import { Bot, MessageCircle, Plus, Send, Trash2 } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import { Button } from '$lib/components/ui/button'
	import { Textarea } from '$lib/components/ui/textarea'
	import type { PageData } from './$types'

	type Conversation = { id: string; title: string; updatedAt: string | number | Date }
	type Message = {
		id: string
		role: 'user' | 'assistant'
		content: string
		createdAt: string | number | Date
	}

	let { data }: { data: PageData } = $props()
	let conversations = $state<Conversation[]>([])
	let messages = $state<Message[]>([])
	let selectedId = $state('')
	let input = $state('')
	let loading = $state(true)
	let sending = $state(false)
	let errorMessage = $state('')

	async function loadConversations() {
		loading = true
		const response = await fetch(`/api/trips/${data.trip.id}/agent`)
		if (response.ok) {
			conversations = await response.json()
			if (conversations[0]) await selectConversation(conversations[0].id)
		}
		loading = false
	}

	async function selectConversation(id: string) {
		selectedId = id
		const response = await fetch(`/api/trips/${data.trip.id}/agent/${id}`)
		if (response.ok) messages = (await response.json()).messages
	}

	async function createConversation() {
		const response = await fetch(`/api/trips/${data.trip.id}/agent`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({})
		})
		if (response.ok) {
			const conversation = await response.json()
			conversations = [conversation, ...conversations]
			messages = []
			selectedId = conversation.id
			return conversation.id as string
		}
		return ''
	}

	async function deleteConversation(id: string) {
		if (!confirm('確定要刪除這段對話嗎？')) return

		const response = await fetch(`/api/trips/${data.trip.id}/agent/${id}`, { method: 'DELETE' })
		if (!response.ok) return

		conversations = conversations.filter((conversation) => conversation.id !== id)
		if (selectedId !== id) return

		selectedId = ''
		messages = []
		if (conversations[0]) await selectConversation(conversations[0].id)
	}

	async function sendMessage(event: SubmitEvent) {
		event.preventDefault()
		if (!input.trim() || sending) return
		const conversationId = selectedId || (await createConversation())
		if (!conversationId) return
		const content = input.trim()
		input = ''
		errorMessage = ''
		sending = true
		const response = await fetch(`/api/trips/${data.trip.id}/agent/${conversationId}/messages`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ content })
		})
		if (response.ok) {
			const result = await response.json()
			messages = [...messages, result.userMessage, result.assistantMessage]
			await loadConversations()
		} else {
			errorMessage =
				(await response.json().catch(() => null))?.message ?? 'AI 暫時無法回應，請稍後再試。'
			input = content
		}
		sending = false
	}

	onMount(loadConversations)
</script>

<svelte:head><title>Travel AI Agent | {data.trip.name}</title></svelte:head>

<main
	class="mx-auto grid min-h-[calc(100vh-150px)] w-full max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[280px_1fr] lg:py-12"
>
	<aside class="border border-black/10 bg-white p-5">
		<div class="flex items-center justify-between border-b border-black/10 pb-5">
			<div>
				<p class="font-mono text-xs font-bold tracking-widest text-black/45">TRAVEL AI</p>
				<h2 class="mt-2 text-2xl font-black">對話紀錄</h2>
			</div>
			<Button
				type="button"
				size="icon"
				class="rounded-none bg-[#d8ff36] text-black hover:bg-[#c8ef28]"
				onclick={createConversation}
				title="新增對話"><Plus class="size-4" /></Button
			>
		</div>
		<div class="mt-5 grid gap-1">
			{#each conversations as conversation (conversation.id)}
				<div
					class="flex items-center border text-sm {selectedId === conversation.id
						? 'border-black bg-[#f4f5f2] font-bold'
						: 'border-transparent text-black/60 hover:bg-[#f4f5f2]'}"
				>
					<button
						type="button"
						class="flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left"
						onclick={() => selectConversation(conversation.id)}
					>
						<MessageCircle class="size-4 shrink-0" /><span class="truncate"
							>{conversation.title}</span
						>
					</button>
					<button
						type="button"
						class="mr-2 rounded p-2 text-black/35 hover:bg-white hover:text-red-600"
						onclick={() => deleteConversation(conversation.id)}
						aria-label="刪除對話"
						title="刪除對話"
					>
						<Trash2 class="size-4" />
					</button>
				</div>
			{/each}
			{#if !loading && conversations.length === 0}<p class="p-3 text-sm text-black/45">
					尚無對話，開始詢問旅程吧。
				</p>{/if}
		</div>
	</aside>

	<section class="flex min-h-[620px] flex-col border border-black/10 bg-white">
		<div class="flex items-center gap-3 border-b border-black/10 p-5 sm:p-7">
			<div class="grid size-10 place-items-center bg-[#d8ff36]"><Bot class="size-5" /></div>
			<div>
				<h1 class="text-xl font-black">Travel AI Agent</h1>
				<p class="text-sm text-black/50">詢問行程、地點、費用與待辦事項</p>
			</div>
		</div>
		<div class="flex-1 space-y-4 overflow-y-auto p-5 sm:p-7">
			{#if messages.length === 0}<div
					class="grid h-full min-h-80 place-items-center text-center text-black/45"
				>
					<div>
						<Bot class="mx-auto mb-3 size-8" />
						<p>例如：幫我整理明天的行程，並提醒我需要確認的物品。</p>
					</div>
				</div>{/if}
			{#each messages as message (message.id)}
				<div class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}">
					<div
						class="max-w-[85%] whitespace-pre-wrap border px-4 py-3 text-sm leading-6 {message.role ===
						'user'
							? 'border-black bg-black text-white'
							: 'border-black/10 bg-[#f4f5f2]'}"
					>
						{message.content}
					</div>
				</div>
			{/each}
			{#if sending}<div class="text-sm text-black/45">AI 正在整理旅程資料…</div>{/if}
			{#if errorMessage}<p class="border border-red-200 bg-red-50 p-3 text-sm text-red-700">
					{errorMessage}
				</p>{/if}
		</div>
		<form class="border-t border-black/10 p-5 sm:p-7" onsubmit={sendMessage}>
			<div class="flex items-end gap-3">
				<Textarea
					bind:value={input}
					rows={2}
					placeholder="輸入你的問題…"
					class="resize-none rounded-none border-black/20 bg-[#fbfcf8]"
					disabled={sending}
				/><Button
					type="submit"
					class="h-10 rounded-none bg-[#151817] px-4 font-bold text-white hover:bg-black"
					disabled={sending || !input.trim()}><Send class="size-4" />送出</Button
				>
			</div>
		</form>
	</section>
</main>
