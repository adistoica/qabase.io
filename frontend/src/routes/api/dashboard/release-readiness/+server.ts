import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data: milestones, error: msError } = await supabase
    .from('milestones')
    .select('id, name, due_at')
    .eq('project_id', project.id)
    .eq('status', 'open')
    .order('due_at', { ascending: true, nullsFirst: false });

  if (msError) throw error(500, msError.message);

  const out = await Promise.all(
    (milestones ?? []).map(async (m) => {
      const { data: rows } = await supabase
        .from('runs')
        .select('summary')
        .eq('project_id', project.id)
        .eq('milestone_id', m.id);

      const totals = (rows ?? []).reduce(
        (acc, r) => {
          const s = r.summary ?? {};
          acc.passed += s.passed ?? 0;
          acc.failed += s.failed ?? 0;
          acc.blocked += s.blocked ?? 0;
          acc.total += s.total ?? 0;
          return acc;
        },
        { passed: 0, failed: 0, blocked: 0, total: 0 }
      );

      return {
        milestone_id: m.id,
        name: m.name,
        due_at: m.due_at,
        pass_rate: totals.total ? totals.passed / totals.total : 0,
        ...totals
      };
    })
  );

  return json(out);
};
