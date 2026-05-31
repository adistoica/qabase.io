import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface SessionIn {
  title: string;
  charter?: string;
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const status = url.searchParams.get('status');

  let query = supabase
    .from('exploratory_sessions')
    .select('*')
    .eq('project_id', project.id)
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  return json(data ?? []);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<SessionIn>(request);
  const title = body.title?.trim();
  if (!title) throw error(400, 'title is required');

  const now = new Date().toISOString();

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .insert({
      project_id: project.id,
      title,
      charter: body.charter ?? '',
      started_by: user.id,
      started_at: now,
      active_since: now
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'exploratory_session.created',
    targetKind: 'exploratory_session',
    targetId: data.id,
    payload: { title }
  });

  return json(data, 201);
};
