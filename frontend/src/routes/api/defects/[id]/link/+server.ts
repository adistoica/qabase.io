import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface LinkResultIn {
  run_id: string;
  result_index: number;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<LinkResultIn>(request);

  const { data: defect } = await supabase
    .from('defects')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!defect) throw error(404, 'defect not found');

  const { data: run } = await supabase
    .from('runs')
    .select('results')
    .eq('id', body.run_id)
    .eq('project_id', project.id)
    .single();

  if (!run) throw error(404, 'run not found');
  const results = run.results ?? [];
  if (body.result_index < 0 || body.result_index >= results.length) {
    throw error(400, 'result_index out of range');
  }

  const refs: Record<string, unknown>[] = defect.run_result_refs ?? [];
  const already = refs.some(
    (r) => r.run_id === body.run_id && r.result_index === body.result_index
  );

  if (!already) {
    refs.push({ run_id: body.run_id, result_index: body.result_index });
    const { data, error: dbError } = await supabase
      .from('defects')
      .update({ run_result_refs: refs, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('project_id', project.id)
      .select()
      .single();
    if (dbError) throw error(500, dbError.message);
    return json(data);
  }

  return json(defect);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<LinkResultIn>(request);

  const { data: defect } = await supabase
    .from('defects')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!defect) throw error(404, 'defect not found');

  const refs = (defect.run_result_refs ?? []).filter(
    (r: Record<string, unknown>) =>
      !(r.run_id === body.run_id && r.result_index === body.result_index)
  );

  const { data, error: dbError } = await supabase
    .from('defects')
    .update({ run_result_refs: refs, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
