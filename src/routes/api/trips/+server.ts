import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  return json([]);
};

export const POST: RequestHandler = async ({ locals, request }) => {
  return json({}, { status: 201 });
};
