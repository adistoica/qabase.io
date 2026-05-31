import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { requireSuperAdmin } from '$lib/server/permissions';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  requireSuperAdmin(user);

  const supabase = adminClient();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: users },
    { data: memberships },
    { data: recentEvents }
  ] = await Promise.all([
    supabase.from('users').select('id, email, display_name, roles, is_active, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('user_id').eq('status', 'active'),
    supabase.from('audit_events').select('actor_id, created_at')
      .gte('created_at', since30d).not('actor_id', 'is', null),
  ]);

  const teamCount: Record<string, number> = {};
  for (const m of memberships ?? []) {
    teamCount[m.user_id] = (teamCount[m.user_id] ?? 0) + 1;
  }

  const userActivity: Record<string, { events30d: number; lastSeen: string | null }> = {};
  for (const e of recentEvents ?? []) {
    const uid = e.actor_id as string;
    if (!userActivity[uid]) userActivity[uid] = { events30d: 0, lastSeen: null };
    userActivity[uid].events30d++;
    if (!userActivity[uid].lastSeen || e.created_at > userActivity[uid].lastSeen!) {
      userActivity[uid].lastSeen = e.created_at;
    }
  }

  const result = (users ?? []).map((u: any) => ({
    id:           u.id,
    email:        u.email,
    display_name: u.display_name,
    roles:        u.roles,
    is_active:    u.is_active,
    created_at:   u.created_at,
    team_count:   teamCount[u.id] ?? 0,
    events_30d:   userActivity[u.id]?.events30d ?? 0,
    last_seen:    userActivity[u.id]?.lastSeen ?? null,
  }));

  return json(result);
};
