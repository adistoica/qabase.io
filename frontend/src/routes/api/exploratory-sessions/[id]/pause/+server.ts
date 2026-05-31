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
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');
  if (session.status !== 'active') throw error(409, 'only active sessions can be paused');

  const now = new Date();
  let elapsedSeconds: number = session.elapsed_seconds ?? 0;

  if (session.active_since) {
    const activeSince = new Date(session.active_since as string);
    elapsedSeconds += Math.max(0, Math.floor((now.getTime() - activeSince.getTime()) / 1000));
  }

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update({
      status: 'paused',
      elapsed_seconds: elapsedSeconds,
      active_since: null,
      updated_at: now.toISOString()
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
