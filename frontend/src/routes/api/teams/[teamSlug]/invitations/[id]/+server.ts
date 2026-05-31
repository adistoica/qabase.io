import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { error } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const { data: invite } = await supabase
    .from('team_invitations')
    .select('id, status')
    .eq('id', params.id!)
    .eq('team_id', team.id)
    .single();

  if (!invite) throw error(404, 'invitation not found');
  if (invite.status !== 'pending') throw error(400, 'invitation is not pending');

  const { error: dbError } = await supabase
    .from('team_invitations')
    .update({ status: 'revoked' })
    .eq('id', params.id!);
  if (dbError) throw error(500, dbError.message);

  return new Response(null, { status: 204 });
};
