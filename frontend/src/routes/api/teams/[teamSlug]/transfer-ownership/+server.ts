import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'owner');

  const body = await parseBody<{ new_owner_id: string }>(request);
  if (!body.new_owner_id) throw error(400, 'new_owner_id is required');
  if (body.new_owner_id === user.id) throw error(400, 'already the owner');

  const { data: targetMember } = await supabase
    .from('team_members')
    .select('role, status')
    .eq('team_id', team.id)
    .eq('user_id', body.new_owner_id)
    .single();
  if (!targetMember || targetMember.status !== 'active') throw error(404, 'active member not found');

  await supabase
    .from('team_members')
    .update({ role: 'admin' })
    .eq('team_id', team.id)
    .eq('user_id', user.id);

  await supabase
    .from('team_members')
    .update({ role: 'owner' })
    .eq('team_id', team.id)
    .eq('user_id', body.new_owner_id);

  const { error: teamErr } = await supabase
    .from('teams')
    .update({ owner_id: body.new_owner_id, updated_at: new Date().toISOString() })
    .eq('id', team.id);
  if (teamErr) throw error(500, teamErr.message);

  return json({ owner_id: body.new_owner_id });
};
