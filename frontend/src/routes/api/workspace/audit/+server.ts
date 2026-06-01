import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  if (!user.roles?.includes('owner') && !user.roles?.includes('manager')) {
    throw error(403, 'requires manager or owner role');
  }

  const action = url.searchParams.get('action');
  const actorId = url.searchParams.get('actor_id');
  const projectId = url.searchParams.get('project_id');
  const skip = Number(url.searchParams.get('skip') ?? '0');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);

  // ip is only returned to owners to limit privacy exposure.
  const fields = user.roles.includes('owner')
    ? 'id, actor_id, project_id, action, target_kind, target_id, payload, ip, created_at'
    : 'id, actor_id, project_id, action, target_kind, target_id, payload, created_at';

  let query = supabase
    .from('audit_events')
    .select(fields)
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (action) query = query.eq('action', action);
  if (actorId) query = query.eq('actor_id', actorId);
  if (projectId) query = query.eq('project_id', projectId);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  return json(data ?? []);
};
