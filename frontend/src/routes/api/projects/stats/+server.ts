import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const { data: allProjects, error: dbError } = await supabase.from('projects').select('id, role_overrides');
  if (dbError) throw error(500, dbError.message);

  const projects = (allProjects ?? []).filter((p) =>
    user.roles.includes('admin') || user.id in (p.role_overrides ?? {})
  );
  const ids = projects.map((p) => p.id);
  if (!ids.length) return json({});

  const [
    { data: caseCounts },
    { data: suiteCounts },
    { data: defectCounts },
  ] = await Promise.all([
    supabase.from('test_cases')
      .select('project_id')
      .in('project_id', ids)
      .eq('archived', false),
    supabase.from('suites')
      .select('project_id')
      .in('project_id', ids),
    supabase.from('defects')
      .select('project_id')
      .in('project_id', ids)
      .eq('status', 'open'),
  ]);

  const stats: Record<string, { cases: number; suites: number; open_defects: number }> = {};
  for (const id of ids) {
    stats[id] = { cases: 0, suites: 0, open_defects: 0 };
  }
  for (const r of caseCounts ?? []) stats[r.project_id].cases++;
  for (const r of suiteCounts ?? []) stats[r.project_id].suites++;
  for (const r of defectCounts ?? []) stats[r.project_id].open_defects++;

  return json(stats);
};
