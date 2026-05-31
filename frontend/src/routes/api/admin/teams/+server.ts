import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { requireSuperAdmin } from '$lib/server/permissions';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  requireSuperAdmin(user);

  const supabase = adminClient();

  const [
    { data: teams },
    { data: members },
    { data: users }
  ] = await Promise.all([
    supabase.from('teams').select('id, name, slug, owner_id, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('team_members').select('team_id').eq('status', 'active'),
    supabase.from('users').select('id, email, display_name'),
  ]);

  const memberCount: Record<string, number> = {};
  for (const m of members ?? []) {
    memberCount[m.team_id] = (memberCount[m.team_id] ?? 0) + 1;
  }

  const userMap: Record<string, { email: string; display_name: string }> = {};
  for (const u of users ?? []) userMap[u.id] = { email: u.email, display_name: u.display_name };

  const result = (teams ?? []).map((t: any) => ({
    id:           t.id,
    name:         t.name,
    slug:         t.slug,
    owner_id:     t.owner_id,
    owner_email:  userMap[t.owner_id]?.email ?? null,
    owner_name:   userMap[t.owner_id]?.display_name ?? null,
    member_count: memberCount[t.id] ?? 0,
    created_at:   t.created_at,
  }));

  return json(result);
};
