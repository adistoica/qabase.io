import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { resolveSuiteCases } from '$lib/server/suite-utils';
import { audit } from '$lib/server/audit';
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

function buildResults(cases: Record<string, unknown>[], assignments: Record<number, string> = []) {
  return cases.map((c, i) => ({
    test_case_id: c.id,
    revision: c.current_revision ?? 1,
    code: c.code ?? '',
    title: c.title,
    status: 'pending',
    assigned_to: assignments[i] ?? null,
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
}

interface RunCreateIn {
  name: string;
  suite_id?: string;
  plan_id?: string;
  milestone_id?: string;
  case_ids?: string[];
  description?: string;
  environment?: Record<string, unknown>;
  environment_id?: string;
  assignments?: Record<number, string>;
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const skip = parseInt(url.searchParams.get('skip') ?? '0');
  const limit = parseInt(url.searchParams.get('limit') ?? '50');
  const milestoneId = url.searchParams.get('milestone_id');
  const planId = url.searchParams.get('plan_id');
  const status = url.searchParams.get('status');

  let query = supabase
    .from('runs')
    .select('*')
    .eq('project_id', project.id)
    .order('started_at', { ascending: false })
    .range(skip, skip + limit - 1);

  if (milestoneId) query = query.eq('milestone_id', milestoneId);
  if (planId) query = query.eq('plan_id', planId);
  if (status) query = query.eq('status', status);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<RunCreateIn>(request);

  let cases: Record<string, unknown>[] = [];
  let suiteId: string | null = null;
  let planId: string | null = null;

  if (body.plan_id) {
    planId = body.plan_id;
    const { data: plan } = await supabase
      .from('test_plans')
      .select('*')
      .eq('id', body.plan_id)
      .eq('project_id', project.id)
      .single();
    if (!plan) throw error(404, 'plan not found');

    const seen = new Map<string, Record<string, unknown>>();

    for (const cid of plan.extra_case_ids ?? []) seen.set(cid, { id: cid });
    for (const sid of plan.suite_ids ?? []) {
      const { data: suite } = await supabase
        .from('suites')
        .select('*')
        .eq('id', sid)
        .eq('project_id', project.id)
        .single();
      if (suite) {
        const suiteCases = await resolveSuiteCases(suite, supabase);
        for (const c of suiteCases) seen.set(c.id as string, c);
      }
    }

    if (seen.size) {
      const ids = Array.from(seen.keys());
      const { data } = await supabase
        .from('test_cases')
        .select('*')
        .eq('project_id', project.id)
        .in('id', ids);
      cases = data ?? [];
    }
  } else if (body.suite_id) {
    suiteId = body.suite_id;
    const { data: suite } = await supabase
      .from('suites')
      .select('*')
      .eq('id', body.suite_id)
      .eq('project_id', project.id)
      .single();
    if (!suite) throw error(404, 'suite not found');
    cases = await resolveSuiteCases(suite, supabase);
  } else if (body.case_ids?.length) {
    const { data } = await supabase
      .from('test_cases')
      .select('*')
      .eq('project_id', project.id)
      .in('id', body.case_ids);
    cases = data ?? [];
  } else {
    throw error(400, 'must supply suite_id, plan_id, or case_ids');
  }

  if (!cases.length) throw error(400, 'no cases resolved for this run');

  let environment = body.environment ?? {};
  if (body.environment_id) {
    const { data: preset } = await supabase
      .from('environments')
      .select('*')
      .eq('id', body.environment_id)
      .eq('project_id', project.id)
      .single();
    if (preset) {
      environment = {
        name: preset.name,
        browser: preset.browser || (environment.browser ?? ''),
        os: preset.os || (environment.os ?? ''),
        build: preset.build || (environment.build ?? ''),
        extra: { ...(preset.variables ?? {}), ...((environment.extra as object) ?? {}) }
      };
    }
  }

  const results = buildResults(cases, body.assignments ?? {});
  const summary = recomputeSummary(results);

  const { data: run, error: dbError } = await supabase
    .from('runs')
    .insert({
      project_id: project.id,
      name: body.name,
      suite_id: suiteId,
      plan_id: planId,
      milestone_id: body.milestone_id ?? null,
      description: body.description ?? '',
      environment,
      started_at: new Date().toISOString(),
      started_by: user.id,
      case_snapshot: cases.map((c) => ({
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

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'run.created',
    targetKind: 'run',
    targetId: run.id,
    payload: { name: run.name, total: summary.total }
  });

  return json(run, 201);
};
