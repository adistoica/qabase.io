import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import { isAtLeast } from '$lib/permissions';
import type { TeamRole } from '$lib/permissions';
import type { RequestHandler } from '@sveltejs/kit';

export const PATCH: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  const actorMembership = await requireTeamRole(team, user, 'admin');

  const targetUserId = params.userId!;
  if (targetUserId === user.id) throw error(400, 'cannot change your own role');

  const { data: targetMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', team.id)
    .eq('user_id', targetUserId)
    .single();
  if (!targetMember) throw error(404, 'member not found');

  if (targetMember.role === 'owner') throw error(403, 'cannot change owner role');

  const body = await parseBody<{ role: TeamRole }>(request);
  const validRoles: TeamRole[] = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(body.role)) throw error(400, 'invalid role');

  if (!isAtLeast(actorMembership.role as TeamRole, body.role)) {
    throw error(403, 'cannot assign a role higher than your own');
  }

  const { error: dbError } = await supabase
    .from('team_members')
    .update({ role: body.role })
    .eq('team_id', team.id)
    .eq('user_id', targetUserId);
  if (dbError) throw error(500, dbError.message);

  return json({ user_id: targetUserId, role: body.role });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const targetUserId = params.userId!;
  if (targetUserId === user.id) throw error(400, 'cannot remove yourself');

  const { data: targetMember } = await supabase
    .from('team_members')
    .select('role')
    .eq('team_id', team.id)
    .eq('user_id', targetUserId)
    .single();
  if (!targetMember) throw error(404, 'member not found');
  if (targetMember.role === 'owner') throw error(403, 'cannot remove the owner');

  const { error: dbError } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', team.id)
    .eq('user_id', targetUserId);
  if (dbError) throw error(500, dbError.message);

  return new Response(null, { status: 204 });
};
