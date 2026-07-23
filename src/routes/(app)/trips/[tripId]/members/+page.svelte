<script lang="ts">
	import { goto } from '$app/navigation'
	import { resolve } from '$app/paths'
	import { Copy, Crown, LogOut, Mail, RefreshCw, Trash2, UserCog, UserPlus } from '@lucide/svelte'
	import { onMount } from 'svelte'
	import ActionMenu from '$lib/components/action-menu.svelte'
	import { Button } from '$lib/components/ui/button'
	import UserAvatar from '$lib/components/user-avatar.svelte'
	import { confirmDialog } from '$lib/stores/confirm'
	import { toast } from '$lib/stores/toast'
	import { offlineFetch } from '$lib/offline-fetch'
	import type { PageData } from './$types'
	type Member = {
		id: string
		userId: string
		name: string | null
		email: string
		image: string | null
		role: string
	}
	type Invite = {
		id: string
		token: string
		expiresAt: string | number
		maxUses: number | null
		useCount: number
	}
	let { data }: { data: PageData } = $props()
	let members = $state<Member[]>([])
	let invites = $state<Invite[]>([])
	let inviteUrl = $state('')
	let copied = $state(false)
	let inviting = $state(false)
	let newInviteMaxUses = $state<number | null>(null)
	const isOwner = $derived(data.role === 'owner')
	const canManage = $derived(
		(data.role === 'owner' || data.role === 'admin') && data.trip.status !== 'completed'
	)
	const ROLE_LABELS: Record<string, string> = {
		owner: '擁有者',
		admin: '管理員',
		member: '成員'
	}
	const activeInvites = $derived(
		invites.filter(
			(invite) =>
				new Date(invite.expiresAt) > new Date() &&
				(invite.maxUses === null || invite.useCount < invite.maxUses)
		)
	)

	function memberLabel(member: Member) {
		return member.name || member.email
	}

	function formatExpiry(value: string | number) {
		return new Intl.DateTimeFormat('zh-TW', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(value))
	}

	async function load() {
		const response = await offlineFetch(`/api/trips/${data.trip.id}/members`)
		if (response.ok) members = await response.json()
		if (canManage) {
			const inviteResponse = await offlineFetch(`/api/trips/${data.trip.id}/invite`)
			if (inviteResponse.ok) invites = await inviteResponse.json()
		}
	}
	async function createInvite() {
		if (inviting) return
		inviting = true
		const response = await fetch(`/api/trips/${data.trip.id}/invite`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ expiresInHours: 72, maxUses: newInviteMaxUses })
		})
		if (response.ok) {
			const created = await response.json()
			inviteUrl = `${location.origin}/invite/${created.token}`
			invites = [...invites, created]
			const usesLabel = newInviteMaxUses === null ? '無限次使用' : `最多 ${newInviteMaxUses} 次使用`
			toast.success(`邀請連結已建立，3 天內有效，${usesLabel}`)
		} else {
			toast.error('建立邀請連結失敗，請稍後再試')
		}
		inviting = false
	}
	async function revokeInvite(invite: Invite) {
		const ok = await confirmDialog({
			title: '撤銷邀請',
			message: '撤銷後這個連結將立即失效，尚未加入的人無法再使用。',
			confirmLabel: '撤銷',
			danger: true
		})
		if (!ok) return
		const res = await fetch(`/api/trips/${data.trip.id}/invite/${invite.token}`, {
			method: 'DELETE'
		})
		if (res.ok) {
			invites = invites.filter((entry) => entry.id !== invite.id)
			if (inviteUrl.endsWith(invite.token)) inviteUrl = ''
			toast.success('邀請已撤銷')
		} else {
			toast.error('撤銷失敗，請稍後再試')
		}
	}
	async function regenerateInvite(invite: Invite) {
		const res = await fetch(`/api/trips/${data.trip.id}/invite/${invite.token}`, {
			method: 'DELETE'
		})
		if (!res.ok) {
			toast.error('重新產生失敗，請稍後再試')
			return
		}
		invites = invites.filter((entry) => entry.id !== invite.id)
		newInviteMaxUses = invite.maxUses
		await createInvite()
	}
	async function copy(token?: string) {
		const url = token ? `${location.origin}/invite/${token}` : inviteUrl
		await navigator.clipboard.writeText(url)
		copied = true
		toast.success('已複製邀請連結')
		setTimeout(() => (copied = false), 1800)
	}

	async function setRole(member: Member, role: 'owner' | 'admin' | 'member') {
		if (role === 'owner') {
			const ok = await confirmDialog({
				title: '轉移擁有權',
				message: `確定要把旅程擁有權轉移給「${memberLabel(member)}」嗎？你會變成管理員。`,
				confirmLabel: '轉移擁有權',
				danger: true
			})
			if (!ok) return
		}
		const res = await fetch(`/api/trips/${data.trip.id}/members/${member.userId}`, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ role })
		})
		if (res.ok) {
			toast.success(
				role === 'owner' ? '擁有權已轉移' : `已將 ${memberLabel(member)} 設為${ROLE_LABELS[role]}`
			)
			if (role === 'owner') location.reload()
			else await load()
		} else {
			toast.error('更新角色失敗，請稍後再試')
		}
	}

	async function removeMember(member: Member) {
		const ok = await confirmDialog({
			title: '移除成員',
			message: `確定要將「${memberLabel(member)}」移出旅程嗎？`,
			confirmLabel: '移除',
			danger: true
		})
		if (!ok) return
		const res = await fetch(`/api/trips/${data.trip.id}/members/${member.userId}`, {
			method: 'DELETE'
		})
		if (res.ok) {
			members = members.filter((entry) => entry.userId !== member.userId)
			toast.success('已移除成員')
		} else {
			toast.error('移除失敗，請稍後再試')
		}
	}

	async function leaveTrip() {
		const ok = await confirmDialog({
			title: '退出旅程',
			message: '退出後將看不到這趟旅程的內容，需要重新被邀請才能加入。',
			confirmLabel: '退出旅程',
			danger: true
		})
		if (!ok) return
		const res = await fetch(`/api/trips/${data.trip.id}/members/${data.user.id}`, {
			method: 'DELETE'
		})
		if (res.ok) {
			await goto(resolve('/trips'))
		} else {
			toast.error('退出失敗，請稍後再試')
		}
	}
	onMount(load)
</script>

<main class="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
	<div
		class="flex flex-col gap-5 border-b border-black/15 pb-6 sm:flex-row sm:items-end sm:justify-between"
	>
		<div>
			<p class="font-mono text-xs font-bold tracking-[0.18em] text-black/45">06 / 成員</p>
			<h2 class="mt-3 text-4xl font-black tracking-[-0.05em]">同行夥伴</h2>
			<p class="mt-3 text-black/55">邀請一起旅行的人，讓所有人看到同一份計畫。</p>
		</div>
		<div class="flex flex-wrap gap-2">
			{#if !isOwner}
				<Button
					type="button"
					variant="outline"
					class="h-11 rounded-none border-black/20 font-bold text-red-600 hover:border-red-600"
					onclick={leaveTrip}><LogOut class="size-4" /> 退出旅程</Button
				>
			{/if}
			{#if canManage}
				<div class="flex items-center gap-2">
					<select
						bind:value={newInviteMaxUses}
						class="h-11 border border-black/20 bg-white px-3 font-mono text-sm font-bold focus:outline-none"
					>
						<option value={null}>無限次</option>
						<option value={1}>1 次</option>
						<option value={5}>5 次</option>
						<option value={10}>10 次</option>
						<option value={20}>20 次</option>
					</select>
					<Button
						type="button"
						disabled={inviting}
						class="h-11 rounded-none bg-[#d8ff36] font-bold text-black hover:bg-[#c8ef28]"
						onclick={createInvite}
						><UserPlus class="size-4" /> {inviting ? '建立中…' : '建立邀請連結'}</Button
					>
				</div>
			{/if}
		</div>
	</div>
	{#if inviteUrl}
		{@const latestInvite = invites.at(-1)}
		<div
			class="mt-6 flex flex-col gap-3 border border-[#b8e600] bg-[#efffc1] p-4 sm:flex-row sm:items-center"
		>
			<Mail class="size-5 shrink-0" />
			<div class="min-w-0 flex-1">
				<p class="truncate font-mono text-sm">{inviteUrl}</p>
				<p class="mt-1 text-xs text-black/50">
					有效期限 3 天・{latestInvite?.maxUses === null
						? '無限次使用'
						: `最多 ${latestInvite?.maxUses} 次使用`}
				</p>
			</div>
			<Button
				type="button"
				variant="outline"
				class="h-9 rounded-none border-black/20 bg-white font-bold"
				onclick={() => copy()}><Copy class="size-4" /> {copied ? '已複製' : '複製連結'}</Button
			>
		</div>
	{/if}

	{#if canManage && activeInvites.length > 0}
		<section class="mt-6 border border-black/10 bg-white p-4">
			<h3 class="font-black">有效的邀請連結</h3>
			<div class="mt-3 grid gap-2">
				{#each activeInvites as invite (invite.id)}
					<div
						class="flex flex-wrap items-center gap-3 border-b border-black/10 pb-2 last:border-b-0 last:pb-0"
					>
						<span class="min-w-0 flex-1 truncate font-mono text-xs text-black/55"
							>…/invite/{invite.token.slice(0, 8)}…</span
						>
						<span class="text-xs text-black/45">
							{invite.maxUses === null
								? `已使用 ${invite.useCount} 次（無限）`
								: `${invite.useCount} / ${invite.maxUses} 次`}
						</span>
						<span class="text-xs text-black/45">到期：{formatExpiry(invite.expiresAt)}</span>
						<button
							type="button"
							title="複製連結"
							class="text-black/40 hover:text-black"
							onclick={() => copy(invite.token)}><Copy class="size-4" /></button
						>
						<button
							type="button"
							title="重新產生（撤銷後建立新連結）"
							class="text-black/40 hover:text-black"
							onclick={() => regenerateInvite(invite)}><RefreshCw class="size-4" /></button
						>
						<button
							type="button"
							title="撤銷邀請"
							class="text-black/40 hover:text-red-600"
							onclick={() => revokeInvite(invite)}><Trash2 class="size-4" /></button
						>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="mt-8 grid gap-2">
		{#each members as member (member.id)}<div
				class="flex items-center gap-4 border border-black/10 bg-white p-4"
			>
				<UserAvatar name={member.name || member.email} image={member.image} class="size-10" />
				<div class="min-w-0 flex-1">
					<p class="truncate font-bold">
						{member.name || '未設定名稱'}
						{#if member.userId === data.user.id}<span
								class="ml-1 font-mono text-[10px] text-black/40">（我）</span
							>{/if}
					</p>
					<p class="truncate text-sm text-black/45">{member.email}</p>
				</div>
				<span
					class="px-2 py-1 text-[10px] font-bold {member.role === 'owner'
						? 'bg-[#151817] text-white'
						: member.role === 'admin'
							? 'bg-[#d8ff36] text-black'
							: 'bg-[#eef0eb] text-black/70'}">{ROLE_LABELS[member.role] ?? member.role}</span
				>
				{#if canManage && member.role !== 'owner' && member.userId !== data.user.id}
					<ActionMenu
						actions={[
							...(isOwner
								? [
										member.role === 'member'
											? {
													label: '設為管理員',
													icon: UserCog,
													onClick: () => setRole(member, 'admin')
												}
											: {
													label: '設為成員',
													icon: UserCog,
													onClick: () => setRole(member, 'member')
												},
										{
											label: '轉移擁有權',
											icon: Crown,
											onClick: () => setRole(member, 'owner')
										}
									]
								: []),
							{
								label: '移除',
								icon: Trash2,
								danger: true,
								onClick: () => removeMember(member)
							}
						]}
					/>
				{/if}
			</div>{/each}{#if members.length === 0}<div
				class="border border-dashed border-black/20 bg-white p-10 text-center text-black/50"
			>
				還沒有成員。
			</div>{/if}
	</section>
</main>
