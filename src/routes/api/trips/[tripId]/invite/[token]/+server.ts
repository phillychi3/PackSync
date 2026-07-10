import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
  return new Response(null, { status: 204 });
};
