import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  await getAuthUser(request);

  const { data } = await supabase
    .from('users')
    .select('id, email, display_name, roles, is_active, created_at')
    .order('created_at', { ascending: false });

  return json(data ?? []);
};
