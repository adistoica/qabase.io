import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireManager } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('share_tokens')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'share not found');

  const { data, error: dbError } = await supabase
    .from('share_tokens')
    .update({ revoked: true })
    .eq('id', params.id)
    .select('id, token, kind, target_id, expires_at, revoked')
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
