import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import { resolveSuiteCases } from '$lib/server/suite-utils';
import type { RequestHandler } from '@sveltejs/kit';

async function getSuite(suiteId: string, projectId: string, supabase: ReturnType<typeof adminClient>) {
  const { data } = await supabase
    .from('suites')
    .select('*')
    .eq('id', suiteId)
    .eq('project_id', projectId)
    .single();
  return data;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const suite = await getSuite(params.id!, project.id, supabase);
  if (!suite) throw error(404, 'suite not found');
  if (suite.type !== 'static') throw error(400, 'can only attach cases to a static suite');

  const { data: caseRow } = await supabase
    .from('test_cases')
    .select('id')
    .eq('id', params.caseId!)
    .eq('project_id', project.id)
    .single();

  if (!caseRow) throw error(404, 'case not found');

  const ids: string[] = suite.static_case_ids ?? [];
  if (!ids.includes(params.caseId!)) {
    const { data, error: dbError } = await supabase
      .from('suites')
      .update({
        static_case_ids: [...ids, params.caseId!],
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .eq('project_id', project.id)
      .select()
      .single();
    if (dbError) throw error(500, dbError.message);
    const cases = await resolveSuiteCases(data, supabase);
    return json({ ...data, case_count: cases.length });
  }

  const cases = await resolveSuiteCases(suite, supabase);
  return json({ ...suite, case_count: cases.length });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const suite = await getSuite(params.id!, project.id, supabase);
  if (!suite) throw error(404, 'suite not found');
  if (suite.type !== 'static') throw error(400, 'can only edit cases on a static suite');

  const ids = (suite.static_case_ids ?? []).filter((i: string) => i !== params.caseId!);

  const { data, error: dbError } = await supabase
    .from('suites')
    .update({ static_case_ids: ids, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const cases = await resolveSuiteCases(data, supabase);
  return json({ ...data, case_count: cases.length });
};
