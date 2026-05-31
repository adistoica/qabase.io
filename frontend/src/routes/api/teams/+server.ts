import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface TeamIn {
  name: string;
  slug: string;
}

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const { data, error: dbError } = await supabase
    .from('team_members')
    .select('team_id, role, status, teams(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if (dbError) throw error(500, dbError.message);

  const teams = (data ?? []).map((row: any) => ({
    ...row.teams,
    my_role: row.role
  }));

  return json(teams);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const body = await parseBody<TeamIn>(request);
  if (!body.name?.trim()) throw error(400, 'name is required');
  if (!body.slug?.trim()) throw error(400, 'slug is required');
  if (!/^[a-z0-9-]+$/.test(body.slug)) throw error(400, 'slug may only contain lowercase letters, numbers, and hyphens');

  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('slug', body.slug)
    .single();
  if (existing) throw error(400, 'slug already taken');

  const { data: team, error: teamErr } = await supabase
    .from('teams')
    .insert({ name: body.name.trim(), slug: body.slug.trim(), owner_id: user.id })
    .select()
    .single();
  if (teamErr || !team) throw error(500, teamErr?.message ?? 'failed to create team');

  const { error: memberErr } = await supabase.from('team_members').insert({
    team_id: team.id,
    user_id: user.id,
    role: 'owner',
    status: 'active'
  });
  if (memberErr) throw error(500, memberErr.message);

  return json({ ...team, my_role: 'owner' }, 201);
};
