import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data: run } = await supabase
    .from('runs')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!run) throw error(404, 'run not found');

  const { data, error: dbError } = await supabase
    .from('attachments')
    .select('id, result_position, step_position, kind, mime, size, original_name, uploaded_at')
    .eq('run_id', params.id)
    .order('uploaded_at', { ascending: true });

  if (dbError) throw error(500, dbError.message);
  return json(data ?? []);
};
