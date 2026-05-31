import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'viewer');

  const { data, error: dbError } = await supabase
    .from('team_members')
    .select('id, role, status, joined_at, users(id, email, display_name)')
    .eq('team_id', team.id)
    .order('joined_at');

  if (dbError) throw error(500, dbError.message);

  const members = (data ?? []).map((row: any) => ({
    id: row.id,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    user: row.users
  }));

  return json(members);
};
