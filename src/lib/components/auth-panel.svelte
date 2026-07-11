<script lang="ts">
	import { enhance } from '$app/forms'
	import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LockKeyhole, Radio } from '@lucide/svelte'
	import { Button } from '$lib/components/ui/button'
	import { Input } from '$lib/components/ui/input'

	let { mode, message }: { mode: 'login' | 'register'; message?: string } = $props()
	let showPassword = $state(false)
	let submitting = $state(false)
	const isLogin = $derived(mode === 'login')
</script>

<svelte:head>
	<title>{isLogin ? '登入' : '建立帳號'} — PackSync</title>
	<meta
		name="description"
		content={isLogin ? '登入 PackSync，繼續規劃旅程。' : '建立 PackSync 帳號，開始第一趟共同旅程。'}
	/>
</svelte:head>

<div class="grid min-h-screen bg-[#f1f2ee] text-[#151817] lg:grid-cols-[0.88fr_1.12fr]">
	<aside
		class="relative hidden overflow-hidden bg-[#1c201f] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14"
	>
		<div
			class="absolute inset-0 opacity-15 [background-image:linear-gradient(rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.14)_1px,transparent_1px)] [background-size:52px_52px]"
		></div>
		<a href="/" class="relative z-10 flex items-center gap-3"
			><span class="grid size-9 place-items-center bg-[#d8ff36] text-xs font-black text-black"
				>PS</span
			><span class="text-lg font-black tracking-[-0.04em]">PACKSYNC</span></a
		>
		<div class="relative z-10 max-w-lg">
			<div
				class="mb-8 flex items-center gap-3 font-mono text-[10px] tracking-[0.16em] text-white/45"
			>
				<Radio class="size-4 text-[#d8ff36]" /> COLLABORATION / ACTIVE
			</div>
			<p class="font-mono text-xs text-[#d8ff36]">TRIP CONTROL SYSTEM</p>
			<h1 class="mt-4 text-5xl font-black leading-[0.95] tracking-[-0.06em] xl:text-7xl">
				把混亂留在<br />出發之前。
			</h1>
			<p class="mt-7 max-w-md text-lg leading-8 text-white/55">
				所有旅伴共享同一份行程、帳目與準備進度。每次更新，自動保持同步。
			</p>
		</div>
		<div
			class="relative z-10 grid grid-cols-3 border-y border-white/15 py-5 font-mono text-[10px] text-white/40"
		>
			<span>SYNC / LIVE</span><span>DATA / SECURE</span><span>ACCESS / PWA</span>
		</div>
	</aside>

	<main class="flex min-h-screen flex-col">
		<header
			class="flex h-18 items-center justify-between border-b border-black/12 px-5 sm:px-8 lg:justify-end"
		>
			<a
				href="/"
				class="flex items-center gap-2 text-sm font-semibold text-black/55 transition hover:text-black lg:hidden"
				><ArrowLeft class="size-4" /> 首頁</a
			>
			<p class="text-sm text-black/50">
				{isLogin ? '還沒有帳號？' : '已經是成員？'}
				<a
					class="ml-2 font-bold text-black underline decoration-[#a7ca18] decoration-2 underline-offset-4"
					href={isLogin ? '/register' : '/login'}>{isLogin ? '免費註冊' : '登入'}</a
				>
			</p>
		</header>

		<div class="flex flex-1 items-center justify-center px-5 py-12 sm:px-8">
			<section class="w-full max-w-md">
				<div class="mb-10">
					<div
						class="mb-5 flex items-center gap-3 font-mono text-[10px] font-bold tracking-[0.15em] text-black/40"
					>
						<span class="h-px w-8 bg-black/25"></span>{isLogin
							? '01 / MEMBER ACCESS'
							: '01 / CREATE IDENTITY'}
					</div>
					<h2 class="text-4xl font-black tracking-[-0.05em] sm:text-5xl">
						{isLogin ? '歡迎回來。' : '準備出發。'}
					</h2>
					<p class="mt-3 text-black/50">
						{isLogin ? '登入後繼續管理你的共同旅程。' : '建立帳號，邀請旅伴一起開始規劃。'}
					</p>
				</div>

				{#if message}
					<div
						role="alert"
						class="mb-6 border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-800"
					>
						<span class="font-mono text-[10px] font-bold">AUTH / ERROR</span>
						<p class="mt-1">{message}</p>
					</div>
				{/if}

				<form
					method="post"
					use:enhance={() => {
						submitting = true
						return async ({ update }) => {
							await update()
							submitting = false
						}
					}}
					class="space-y-5"
				>
					{#if !isLogin}
						<label class="block"
							><span class="mb-2 block text-sm font-bold">顯示名稱</span><Input
								name="name"
								autocomplete="name"
								required
								placeholder="你的名字"
								class="h-13 w-full border border-black/20 bg-white px-4 text-base outline-none transition placeholder:text-black/25 focus:border-black focus:ring-2 focus:ring-[#d8ff36]"
							/></label
						>
					{/if}
					<label class="block"
						><span class="mb-2 block text-sm font-bold">電子郵件</span><Input
							type="email"
							name="email"
							autocomplete="email"
							required
							placeholder="name@example.com"
							class="h-13 w-full border border-black/20 bg-white px-4 text-base outline-none transition placeholder:text-black/25 focus:border-black focus:ring-2 focus:ring-[#d8ff36]"
						/></label
					>
					<label class="block"
						><span class="mb-2 flex items-center justify-between text-sm font-bold"
							>密碼 {#if isLogin}<a href="/login" class="font-normal text-black/45 hover:text-black"
									>忘記密碼？</a
								>{/if}</span
						><span class="relative block"
							><Input
								type={showPassword ? 'text' : 'password'}
								name="password"
								autocomplete={isLogin ? 'current-password' : 'new-password'}
								minlength={8}
								required
								placeholder="至少 8 個字元"
								class="h-13 w-full border border-black/20 bg-white px-4 pr-12 text-base outline-none transition placeholder:text-black/25 focus:border-black focus:ring-2 focus:ring-[#d8ff36]"
							/><Button
								variant="ghost"
								size="icon"
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute top-1/2 right-2 -translate-y-1/2 rounded-none text-black/40 hover:bg-black/5 hover:text-black"
								aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
								>{#if showPassword}<EyeOff class="size-5" />{:else}<Eye
										class="size-5"
									/>{/if}</Button
							></span
						></label
					>
					{#if !isLogin}<p class="flex items-start gap-2 text-xs leading-5 text-black/45">
							<Check class="mt-0.5 size-3.5 shrink-0" /> 建立帳號即表示你同意以負責任的方式使用 PackSync
							服務。
						</p>{/if}
					<Button
						type="submit"
						disabled={submitting}
						class="group flex h-14 w-full items-center justify-between bg-[#171a19] px-5 font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
						><span>{submitting ? '處理中…' : isLogin ? '登入工作區' : '建立免費帳號'}</span
						>{#if submitting}<span
								class="size-4 animate-spin rounded-full border-2 border-white/30 border-t-[#d8ff36]"
							></span>{:else}<ArrowRight
								class="size-5 text-[#d8ff36] transition group-hover:translate-x-1"
							/>{/if}</Button
					>
				</form>
				<div
					class="mt-8 flex items-center justify-center gap-2 font-mono text-[10px] tracking-wider text-black/35"
				>
					<LockKeyhole class="size-3.5" /> SECURE SESSION / HTTP-ONLY
				</div>
			</section>
		</div>
	</main>
</div>
