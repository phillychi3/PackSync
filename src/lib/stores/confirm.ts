import { writable } from 'svelte/store'

export type ConfirmRequest = {
	title: string
	message: string
	confirmLabel: string
	cancelLabel: string
	danger: boolean
	resolve: (confirmed: boolean) => void
}

export const confirmRequest = writable<ConfirmRequest | null>(null)

export function confirmDialog(options: {
	title?: string
	message: string
	confirmLabel?: string
	cancelLabel?: string
	danger?: boolean
}): Promise<boolean> {
	return new Promise((resolve) => {
		confirmRequest.set({
			title: options.title ?? '確認操作',
			message: options.message,
			confirmLabel: options.confirmLabel ?? '確認',
			cancelLabel: options.cancelLabel ?? '取消',
			danger: options.danger ?? false,
			resolve
		})
	})
}
