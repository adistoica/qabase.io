import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const targetUserId = params.userId!;
  if (targetUserId === user.id) throw error(400, 'cannot deactivate yourself');

  const { data: targetMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', team.id)
    .eq('user_id', targetUserId)
    .single();
  if (!targetMember) throw error(404, 'member not found');
  if (targetMember.role === 'owner') throw error(403, 'cannot deactivate the owner');

  const { error: dbError } = await supabase
    .from('team_members')
    .update({ status: 'deactivated' })
    .eq('team_id', team.id)
    .eq('user_id', targetUserId);
  if (dbError) throw error(500, dbError.message);

  return json({ user_id: targetUserId, status: 'deactivated' });
};
