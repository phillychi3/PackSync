import { writable } from 'svelte/store'

export type Toast = {
	id: number
	type: 'success' | 'error' | 'info'
	message: string
	action?: { label: string; onClick: () => void }
	duration: number
}

export const toasts = writable<Toast[]>([])

let nextId = 1

function push(
	type: Toast['type'],
	message: string,
	options?: Partial<Pick<Toast, 'action' | 'duration'>>
) {
	const id = nextId++
	const toast: Toast = {
		id,
		type,
		message,
		action: options?.action,
		duration: options?.duration ?? (options?.action ? 6000 : 3500)
	}
	toasts.update((list) => [...list, toast])
	setTimeout(() => dismissToast(id), toast.duration)
	return id
}

export function dismissToast(id: number) {
	toasts.update((list) => list.filter((toast) => toast.id !== id))
}

export const toast = {
	success: (message: string, options?: Partial<Pick<Toast, 'action' | 'duration'>>) =>
		push('success', message, options),
	error: (message: string, options?: Partial<Pick<Toast, 'action' | 'duration'>>) =>
		push('error', message, options),
	info: (message: string, options?: Partial<Pick<Toast, 'action' | 'duration'>>) =>
		push('info', message, options)
}
