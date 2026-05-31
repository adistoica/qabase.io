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

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const milestoneId = url.searchParams.get('milestone_id');

  let query = supabase
    .from('test_plans')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (milestoneId) query = query.eq('milestone_id', milestoneId);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  const out = await Promise.all(
    (data ?? []).map(async (p) => ({
      ...p,
      case_count: await resolvePlanCount(p, project.id, supabase)
    }))
  );
  return json(out);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<PlanIn>(request);

  const { data, error: dbError } = await supabase
    .from('test_plans')
    .insert({
      project_id: project.id,
      name: body.name,
      description: body.description ?? '',
      milestone_id: body.milestone_id ?? null,
      suite_ids: body.suite_ids ?? [],
      extra_case_ids: body.extra_case_ids ?? []
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const caseCount = await resolvePlanCount(data, project.id, supabase);
  return json({ ...data, case_count: caseCount }, 201);
};
