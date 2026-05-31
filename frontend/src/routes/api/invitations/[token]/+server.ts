import { adminClient } from '$lib/server/supabase';
import { getOptionalUser } from '$lib/server/auth';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  await getOptionalUser(request);

  const { data, error: dbError } = await supabase
    .from('team_invitations')
    .select('id, email, role, status, expires_at, teams(id, name, slug), users!invited_by(display_name)')
    .eq('token', params.token!)
    .single();

  if (dbError || !data) throw error(404, 'invitation not found');
  if (data.status !== 'pending') throw error(410, 'invitation is no longer valid');
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('team_invitations').update({ status: 'expired' }).eq('token', params.token!);
    throw error(410, 'invitation has expired');
  }

  return json({
    id: data.id,
    email: data.email,
    role: data.role,
    expires_at: data.expires_at,
    team: data.teams,
    invited_by: (data.users as any)?.display_name ?? 'A team member'
  });
};
