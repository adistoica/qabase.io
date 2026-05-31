import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { resolveSuiteCases } from '$lib/server/suite-utils';
import type { RequestHandler } from '@sveltejs/kit';

interface PlanIn {
  name: string;
  description?: string;
  milestone_id?: string | null;
  suite_ids?: string[];
  extra_case_ids?: string[];
}

async function resolvePlanCount(
  plan: Record<string, unknown>,
  projectId: string,
  supabase: ReturnType<typeof adminClient>
): Promise<number> {
  const seen = new Set<string>();
  for (const cid of (plan.extra_case_ids as string[]) ?? []) seen.add(cid);
  for (const sid of (plan.suite_ids as string[]) ?? []) {
    const { data: suite } = await supabase
      .from('suites')
      .select('*')
      .eq('id', sid)
      .eq('project_id', projectId)
      .single();
    if (suite) {
      const cases = await resolveSuiteCases(suite, supabase);
      for (const c of cases) seen.add(c.id as string);
    }
  }
  return seen.size;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('test_plans')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !data) throw error(404, 'plan not found');
  const caseCount = await resolvePlanCount(data, project.id, supabase);
  return json({ ...data, case_count: caseCount });
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<PlanIn>(request);

  const { data: existing } = await supabase
    .from('test_plans')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'plan not found');

  const { data, error: dbError } = await supabase
    .from('test_plans')
    .update({
      name: body.name,
      description: body.description ?? '',
      milestone_id: body.milestone_id ?? null,
      suite_ids: body.suite_ids ?? [],
      extra_case_ids: body.extra_case_ids ?? [],
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const caseCount = await resolvePlanCount(data, project.id, supabase);
  return json({ ...data, case_count: caseCount });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('test_plans')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'plan not found');

  const { error: dbError } = await supabase
    .from('test_plans')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
