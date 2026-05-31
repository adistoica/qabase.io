import { getAuthUser } from '$lib/server/auth';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  return json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    roles: user.roles
  });
};
