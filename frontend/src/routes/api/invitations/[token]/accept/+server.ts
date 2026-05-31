import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const { data: invite, error: inviteErr } = await supabase
    .from('team_invitations')
    .select('id, team_id, email, role, status, expires_at')
    .eq('token', params.token!)
    .single();

  if (inviteErr || !invite) throw error(404, 'invitation not found');
  if (invite.status !== 'pending') throw error(410, 'invitation is no longer valid');
  if (new Date(invite.expires_at) < new Date()) {
    await supabase.from('team_invitations').update({ status: 'expired' }).eq('token', params.token!);
    throw error(410, 'invitation has expired');
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw error(403, 'this invitation was sent to a different email address');
  }

  const { data: existingMember } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', invite.team_id)
    .eq('user_id', user.id)
    .single();
  if (existingMember) throw error(400, 'already a team member');

  const { error: memberErr } = await supabase.from('team_members').insert({
    team_id: invite.team_id,
    user_id: user.id,
    role: invite.role,
    status: 'active'
  });
  if (memberErr) throw error(500, memberErr.message);

  await supabase.from('team_invitations').update({ status: 'accepted' }).eq('id', invite.id);

  const { data: team } = await supabase.from('teams').select('slug').eq('id', invite.team_id).single();

  return json({ team_slug: team?.slug ?? null, role: invite.role });
};
