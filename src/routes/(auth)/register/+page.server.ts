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
		const name = data.get('name')?.toString().trim() ?? ''
		const email = data.get('email')?.toString().trim() ?? ''
		const password = data.get('password')?.toString() ?? ''
		if (!name || !email || !password) return fail(400, { message: '請完整填寫所有欄位。' })
		if (password.length < 8) return fail(400, { message: '密碼至少需要 8 個字元。' })
		try {
			await auth.api.signUpEmail({ body: { name, email, password } })
		} catch (error) {
			if (error instanceof APIError)
				return fail(400, {
					message:
						error.status === 'UNPROCESSABLE_ENTITY'
							? '此電子郵件已經註冊。'
							: '無法建立帳號，請確認輸入內容。'
				})
			return fail(500, { message: '目前無法建立帳號，請稍後再試。' })
		}
		redirect(303, '/trips')
	}
}
