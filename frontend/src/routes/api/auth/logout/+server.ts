import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = () => {
  return json({ ok: true });
};
