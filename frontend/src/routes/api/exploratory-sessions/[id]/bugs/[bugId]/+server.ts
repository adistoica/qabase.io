import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: session } = await supabase
    .from('exploratory_sessions')
    .select('discovered_bugs')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');

  const before = (session.discovered_bugs as Record<string, unknown>[]) ?? [];
  const after = before.filter((b) => b.id !== params.bugId);
  if (after.length === before.length) throw error(404, 'bug not found');

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update({ discovered_bugs: after, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
