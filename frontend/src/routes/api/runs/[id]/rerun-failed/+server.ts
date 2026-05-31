import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

function recomputeSummary(results: Record<string, unknown>[]) {
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
  for (const r of results) {
    const s = (r.status as string) ?? 'pending';
    if (s in counts) counts[s as keyof typeof counts]++;
  }
  const total = results.length;
  return { ...counts, total, pass_rate: total ? counts.passed / total : 0 };
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: src, error: dbError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !src) throw error(404, 'run not found');

  const failedResults = (src.results ?? []).filter(
    (r: Record<string, unknown>) => r.status === 'failed'
  );
  if (!failedResults.length) throw error(400, 'no failed results to rerun');

  const failedCaseIds = failedResults.map((r: Record<string, unknown>) => r.test_case_id);

  const { data: cases } = await supabase
    .from('test_cases')
    .select('*')
    .eq('project_id', project.id)
    .in('id', failedCaseIds);

  const results = (cases ?? []).map((c: Record<string, unknown>) => ({
    test_case_id: c.id,
    revision: c.current_revision ?? 1,
    code: c.code ?? '',
    title: c.title,
    status: 'pending',
    assigned_to: null,
    executed_by: null,
    executed_at: null,
    notes_md: '',
    step_results: ((c.steps as unknown[]) ?? []).map((_, j) => ({
      position: j,
      status: 'pending',
      notes_md: '',
      executed_at: null
    })),
    defect_links: []
  }));

  const summary = recomputeSummary(results);

  const { data: newRun, error: insertError } = await supabase
    .from('runs')
    .insert({
      project_id: project.id,
      name: `Re-run failed — ${src.name}`,
      suite_id: src.suite_id,
      plan_id: src.plan_id,
      milestone_id: src.milestone_id,
      description: `Re-run of failures from run ${src.id}`,
      environment: src.environment,
      started_at: new Date().toISOString(),
      started_by: user.id,
      source: 'rerun',
      case_snapshot: (cases ?? []).map((c: Record<string, unknown>) => ({
        test_case_id: c.id,
        revision: c.current_revision ?? 1,
        code: c.code ?? '',
        title: c.title,
        priority: c.priority,
        component: c.component,
        tags: c.tags ?? []
      })),
      results,
      summary
    })
    .select()
    .single();

  if (insertError) throw error(500, insertError.message);
  return json(newRun, 201);
};
