import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { requireSuperAdmin } from '$lib/server/permissions';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  requireSuperAdmin(user);

  const supabase = adminClient();
  const now = new Date();
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const since7d  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000).toISOString();
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: totalTeams },
    { count: totalProjects },
    { count: totalCases },
    { count: openDefects },
    { count: runsLast30d },
    { count: runsInProgress },
    { count: newUsers7d },
    { data: activeUsersData },
    { data: activityRows },
    { data: signupRows },
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('test_cases').select('*', { count: 'exact', head: true }).eq('archived', false),
    supabase.from('defects').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
    supabase.from('runs').select('*', { count: 'exact', head: true }).gte('started_at', since30d),
    supabase.from('runs').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', since7d),
    // active users = distinct actor_ids in audit_events last 7d
    supabase.from('audit_events').select('actor_id').gte('created_at', since7d).not('actor_id', 'is', null),
    // activity trend: audit events per day for last 14d
    supabase.from('audit_events').select('created_at').gte('created_at', since14d),
    // signup trend: user created_at for last 14d
    supabase.from('users').select('created_at').gte('created_at', since14d),
  ]);

  const activeUsers = new Set((activeUsersData ?? []).map((r: any) => r.actor_id)).size;

  function buildBuckets(rows: any[], field: string) {
    const buckets: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    for (const row of rows ?? []) {
      const day = (row[field] as string).slice(0, 10);
      if (day in buckets) buckets[day]++;
    }
    return Object.entries(buckets).map(([date, count]) => ({ date, count }));
  }

  return json({
    total_users:      totalUsers      ?? 0,
    total_teams:      totalTeams      ?? 0,
    total_projects:   totalProjects   ?? 0,
    total_cases:      totalCases      ?? 0,
    open_defects:     openDefects     ?? 0,
    runs_last_30d:    runsLast30d     ?? 0,
    runs_in_progress: runsInProgress  ?? 0,
    new_users_7d:     newUsers7d      ?? 0,
    active_users_7d:  activeUsers,
    activity_trend:   buildBuckets(activityRows ?? [], 'created_at'),
    signup_trend:     buildBuckets(signupRows ?? [], 'created_at'),
  });
};
