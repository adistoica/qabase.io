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

  const pid = project.id;

  const [
    { count: totalCases },
    { count: totalRuns },
    { count: activeRuns },
    { count: openMilestones },
    { data: recentRuns },
    { data: trendData }
  ] = await Promise.all([
    supabase.from('test_cases').select('*', { count: 'exact', head: true })
      .eq('project_id', pid).eq('archived', false),
    supabase.from('runs').select('*', { count: 'exact', head: true })
      .eq('project_id', pid),
    supabase.from('runs').select('*', { count: 'exact', head: true })
      .eq('project_id', pid).eq('status', 'in_progress'),
    supabase.from('milestones').select('*', { count: 'exact', head: true })
      .eq('project_id', pid).eq('status', 'open'),
    supabase.from('runs').select('id, name, status, summary, started_at')
      .eq('project_id', pid).order('started_at', { ascending: false }).limit(5),
    supabase.rpc('dashboard_trend', {
      p_project_id: pid,
      p_since: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    })
  ]);

  const trend = (trendData ?? []).map((row: Record<string, unknown>) => ({
    date: row.day,
    pass_rate: row.total ? Number(row.passed) / Number(row.total) : 0,
    total: row.total
  }));

  return json({
    total_cases: totalCases ?? 0,
    total_runs: totalRuns ?? 0,
    active_runs: activeRuns ?? 0,
    open_milestones: openMilestones ?? 0,
    recent_runs: recentRuns ?? [],
    trend
  });
};
