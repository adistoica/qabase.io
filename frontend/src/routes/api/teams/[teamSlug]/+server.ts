import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { getTeamBySlug, requireTeamRole } from '$lib/server/team-auth';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'viewer');
  return json(team);
};

export const PATCH: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'admin');

  const body = await parseBody<{ name?: string; slug?: string }>(request);
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) {
    if (!body.name.trim()) throw error(400, 'name cannot be empty');
    updates.name = body.name.trim();
  }
  if (body.slug !== undefined) {
    if (!/^[a-z0-9-]+$/.test(body.slug)) throw error(400, 'slug may only contain lowercase letters, numbers, and hyphens');
    const { data: existing } = await supabase.from('teams').select('id').eq('slug', body.slug).single();
    if (existing && existing.id !== team.id) throw error(400, 'slug already taken');
    updates.slug = body.slug;
  }

  const { data, error: dbError } = await supabase.from('teams').update(updates).eq('id', team.id).select().single();
  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const team = await getTeamBySlug(params.teamSlug!);
  await requireTeamRole(team, user, 'owner');

  const { error: dbError } = await supabase.from('teams').delete().eq('id', team.id);
  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
