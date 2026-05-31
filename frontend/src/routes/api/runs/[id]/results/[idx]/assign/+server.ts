import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const idx = parseInt(params.idx!);
  const userId = url.searchParams.get('user_id');

  const { data: run, error: dbError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !run) throw error(404, 'run not found');

  const results: Record<string, unknown>[] = [...(run.results ?? [])];
  if (idx < 0 || idx >= results.length) throw error(400, 'result_index out of range');

  results[idx] = { ...results[idx], assigned_to: userId };

  const { data, error: updateError } = await supabase
    .from('runs')
    .update({ results })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (updateError) throw error(500, updateError.message);
  return json(data);
};
