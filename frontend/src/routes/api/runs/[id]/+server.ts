import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !data) throw error(404, 'run not found');
  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: existing } = await supabase
    .from('runs')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'run not found');

  const { error: dbError } = await supabase
    .from('runs')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
