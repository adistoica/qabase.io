import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const isOwner = user.roles.includes('owner');

  const [
    { data: allProjects },
    { count: totalUsers },
    { count: runsLast30d },
  ] = await Promise.all([
    supabase.from('projects').select('id, role_overrides'),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('runs').select('*', { count: 'exact', head: true }).gte('started_at', since30d),
  ]);

  const accessibleProjects = isOwner
    ? (allProjects ?? [])
    : (allProjects ?? []).filter((p) => p.role_overrides && user.id in p.role_overrides);

  return json({
    total_projects: accessibleProjects.length,
    total_users:    totalUsers    ?? 0,
    runs_last_30d:  runsLast30d   ?? 0,
  });
};
