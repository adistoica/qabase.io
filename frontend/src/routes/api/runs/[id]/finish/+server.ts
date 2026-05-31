import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import { fanOut } from '$lib/server/notify';
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

  const { data: run, error: dbError } = await supabase
    .from('runs')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !run) throw error(404, 'run not found');

  const summary = recomputeSummary(run.results ?? []);
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('runs')
    .update({ status: 'completed', finished_at: now, summary, notified: true })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (updateError) throw error(500, updateError.message);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'run.finished',
    targetKind: 'run',
    targetId: params.id,
    payload: { pass_rate: summary.pass_rate }
  });

  if (!run.notified) {
    fanOut(
      project,
      'run.finished',
      `✅ Run finished: ${run.name} — ${Math.round(summary.pass_rate * 100)}% pass (${summary.passed}/${summary.total})`,
      { run_id: run.id, summary }
    ).catch(() => {});
  }

  return json(updated);
};
