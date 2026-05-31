import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { fanOut } from '$lib/server/notify';
import type { RequestHandler } from '@sveltejs/kit';

interface StepResultIn {
  position: number;
  status: string;
  notes_md?: string;
}

interface ResultUpdateIn {
  status?: string;
  notes_md?: string;
  assigned_to?: string | null;
  step_results?: StepResultIn[];
  add_defect?: Record<string, unknown>;
}

function recomputeSummary(results: Record<string, unknown>[]) {
  const counts = { passed: 0, failed: 0, blocked: 0, skipped: 0, pending: 0 };
  for (const r of results) {
    const s = (r.status as string) ?? 'pending';
    if (s in counts) counts[s as keyof typeof counts]++;
  }
  const total = results.length;
  return { ...counts, total, pass_rate: total ? counts.passed / total : 0 };
}

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const idx = parseInt(params.idx!);
  const body = await parseBody<ResultUpdateIn>(request);

  const { data: run, error: dbError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !run) throw error(404, 'run not found');

  const results: Record<string, unknown>[] = run.results ?? [];
  if (idx < 0 || idx >= results.length) throw error(400, 'result_index out of range');

  const result = { ...results[idx] } as Record<string, unknown>;
  const prevStatus = result.status as string;
  const now = new Date().toISOString();

  if (body.status !== undefined) {
    result.status = body.status;
    result.executed_by = user.id;
    result.executed_at = now;
  }
  if (body.notes_md !== undefined) result.notes_md = body.notes_md;
  if (body.assigned_to !== undefined) result.assigned_to = body.assigned_to;

  if (body.step_results?.length) {
    const stepResults = (result.step_results as Record<string, unknown>[]) ?? [];
    const byPos = new Map(body.step_results.map((s) => [s.position, s]));
    const updated = stepResults.map((sr) => {
      const incoming = byPos.get(sr.position as number);
      if (!incoming) return sr;
      return { ...sr, status: incoming.status, notes_md: incoming.notes_md ?? '', executed_at: now };
    });

    if (updated.length && updated.every((s) => s.status === 'passed')) {
      if (result.status === 'pending') result.status = 'passed';
    }
    if (updated.some((s) => s.status === 'failed')) result.status = 'failed';
    result.step_results = updated;
  }

  if (body.add_defect) {
    const defectLinks = (result.defect_links as Record<string, unknown>[]) ?? [];
    defectLinks.push(body.add_defect);
    result.defect_links = defectLinks;
  }

  results[idx] = result;
  const summary = recomputeSummary(results);

  const { data: updated, error: updateError } = await supabase
    .from('runs')
    .update({ results, summary })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (updateError) throw error(500, updateError.message);

  if (prevStatus !== 'failed' && result.status === 'failed') {
    fanOut(
      project,
      'test.failed',
      `❌ ${run.name} — ${result.code || result.title} failed`,
      { run_id: run.id, result_index: idx, title: result.title, code: result.code }
    ).catch(() => {});
  }

  return json(updated);
};
