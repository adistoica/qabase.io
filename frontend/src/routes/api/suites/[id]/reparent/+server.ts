import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { resolveSuiteCases } from '$lib/server/suite-utils';
import type { RequestHandler } from '@sveltejs/kit';

interface ReparentIn {
  parent_id?: string | null;
  position?: number;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<ReparentIn>(request);
  const newParent = body.parent_id ?? null;
  const position = Math.max(0, body.position ?? 0);

  const { data: suite } = await supabase
    .from('suites')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!suite) throw error(404, 'suite not found');

  // Shift siblings to make room
  let siblingsQuery = supabase
    .from('suites')
    .select('id, position')
    .eq('project_id', project.id)
    .neq('id', params.id)
    .gte('position', position);

  if (newParent) {
    siblingsQuery = siblingsQuery.eq('parent_id', newParent);
  } else {
    siblingsQuery = siblingsQuery.is('parent_id', null);
  }

  const { data: siblingsToShift } = await siblingsQuery;
  for (const sib of siblingsToShift ?? []) {
    await supabase
      .from('suites')
      .update({ position: sib.position + 1 })
      .eq('id', sib.id);
  }

  const { data, error: dbError } = await supabase
    .from('suites')
    .update({
      parent_id: newParent,
      position,
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const cases = await resolveSuiteCases(data, supabase);
  return json({ ...data, case_count: cases.length });
};
