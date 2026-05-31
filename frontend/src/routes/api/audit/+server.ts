import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireManager } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const action = url.searchParams.get('action');
  const actorId = url.searchParams.get('actor_id');
  const skip = Number(url.searchParams.get('skip') ?? '0');
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '100'), 500);

  let query = supabase
    .from('audit_events')
    .select('id, actor_id, action, target_kind, target_id, payload, ip, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (action) query = query.eq('action', action);
  if (actorId) query = query.eq('actor_id', actorId);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  return json(data ?? []);
};
