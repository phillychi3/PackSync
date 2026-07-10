import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  return json([]);
};

export const POST: RequestHandler = async ({ locals, params, request }) => {
  return json({}, { status: 201 });
};
