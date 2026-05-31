import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = () => {
  return json({ status: 'ok' });
};
