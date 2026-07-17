import type { RequestHandler } from './$types'

export const HEAD: RequestHandler = () => new Response(null, { status: 204 })
