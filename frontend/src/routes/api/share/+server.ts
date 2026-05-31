import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface ShareIn {
  kind: 'run' | 'dashboard' | 'plan';
  target_id?: string;
  ttl_days?: number;
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data, error: dbError } = await supabase
    .from('share_tokens')
    .select('id, token, kind, target_id, expires_at, revoked, created_at')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (dbError) throw error(500, dbError.message);
  return json(data ?? []);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<ShareIn>(request);
  const ttlDays = Math.max(1, body.ttl_days ?? 30);
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error: dbError } = await supabase
    .from('share_tokens')
    .insert({
      project_id: project.id,
      kind: body.kind,
      target_id: body.target_id ?? null,
      created_by: user.id,
      token: generateToken(),
      expires_at: expiresAt
    })
    .select('id, token, kind, target_id, expires_at, revoked')
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data, 201);
};
