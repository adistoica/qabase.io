import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { requireOwner } from '$lib/server/permissions';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  requireOwner(user);

  const supabase = adminClient();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: projects },
    { data: cases },
    { data: runs },
    { data: defects },
  ] = await Promise.all([
    supabase.from('projects').select('id, name, slug, created_at').order('created_at', { ascending: false }),
    supabase.from('test_cases').select('project_id').eq('archived', false),
    supabase.from('runs').select('project_id, started_at, status').gte('started_at', since30d),
    supabase.from('defects').select('project_id, status'),
  ]);

  // Build per-project aggregates in JS
  const caseCount: Record<string, number> = {};
  for (const c of cases ?? []) caseCount[c.project_id] = (caseCount[c.project_id] ?? 0) + 1;

  const runs30d: Record<string, number> = {};
  const lastRun: Record<string, string> = {};
  for (const r of runs ?? []) {
    runs30d[r.project_id] = (runs30d[r.project_id] ?? 0) + 1;
    if (!lastRun[r.project_id] || r.started_at > lastRun[r.project_id]) {
      lastRun[r.project_id] = r.started_at;
    }
  }

  const openDefects: Record<string, number> = {};
  for (const d of defects ?? []) {
    if (d.status === 'open' || d.status === 'in_progress') {
      openDefects[d.project_id] = (openDefects[d.project_id] ?? 0) + 1;
    }
  }

  type ProjectRow = { id: string; name: string; slug: string; created_at: string };
  const result = (projects ?? []).map((p: ProjectRow) => ({
    id:           p.id,
    name:         p.name,
    slug:         p.slug,
    created_at:   p.created_at,
    case_count:   caseCount[p.id]  ?? 0,
    runs_30d:     runs30d[p.id]    ?? 0,
    open_defects: openDefects[p.id] ?? 0,
    last_run_at:  lastRun[p.id]    ?? null,
  })).sort((a, b) => (b.runs_30d - a.runs_30d) || (b.case_count - a.case_count));

  return json(result);
};
