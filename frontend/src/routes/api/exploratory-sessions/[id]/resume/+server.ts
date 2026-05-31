import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: session } = await supabase
    .from('exploratory_sessions')
    .select('status')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');
  if (session.status !== 'paused') throw error(409, 'only paused sessions can be resumed');

  const now = new Date().toISOString();

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update({ status: 'active', active_since: now, updated_at: now })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
