import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { TeamRole } from '$lib/permissions';
import type { RequestHandler } from '@sveltejs/kit';

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const { data, error: dbError } = await supabase
    .from('team_invitations')
    .select('id, email, role, status, expires_at, created_at, users!invited_by(display_name, email)')
    .eq('team_id', team.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (dbError) throw error(500, dbError.message);
  return json(data ?? []);
};

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const body = await parseBody<{ email: string; role?: TeamRole }>(request);
  if (!body.email?.includes('@')) throw error(400, 'valid email is required');

  const role: TeamRole = body.role ?? 'member';
  const validRoles: TeamRole[] = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(role)) throw error(400, 'invalid role');

  const { data: existingMember } = await supabase
    .from('users')
    .select('id')
    .eq('email', body.email)
    .single();

  if (existingMember) {
    const { data: alreadyIn } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', team.id)
      .eq('user_id', existingMember.id)
      .single();
    if (alreadyIn) throw error(400, 'user is already a team member');
  }

  const { data: pending } = await supabase
    .from('team_invitations')
    .select('id')
    .eq('team_id', team.id)
    .eq('email', body.email)
    .eq('status', 'pending')
    .single();
  if (pending) throw error(400, 'invitation already pending for this email');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error: dbError } = await supabase
    .from('team_invitations')
    .insert({
      team_id: team.id,
      invited_by: user.id,
      email: body.email,
      role,
      token,
      status: 'pending',
      expires_at: expiresAt
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  return json({ ...data, invite_url: `/invite/${token}` }, 201);
};
