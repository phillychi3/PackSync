import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  return json({});
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  return new Response(null, { status: 204 });
};
