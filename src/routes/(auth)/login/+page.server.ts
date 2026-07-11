import { fail, redirect } from '@sveltejs/kit'
import { APIError } from 'better-auth/api'
import { auth } from '$lib/server/auth'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) redirect(302, '/trips')
	return {}
}

export const actions: Actions = {
	default: async (event) => {
		const data = await event.request.formData()
		const email = data.get('email')?.toString().trim() ?? ''
		const password = data.get('password')?.toString() ?? ''
		if (!email || !password) return fail(400, { message: '請輸入電子郵件與密碼。' })
		try {
			await auth.api.signInEmail({ body: { email, password } })
		} catch (error) {
			if (error instanceof APIError) return fail(400, { message: '電子郵件或密碼不正確。' })
			return fail(500, { message: '目前無法登入，請稍後再試。' })
		}
		redirect(303, '/trips')
	}
}
