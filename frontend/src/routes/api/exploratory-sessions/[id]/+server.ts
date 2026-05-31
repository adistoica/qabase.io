import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa, requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface SessionUpdateIn {
  title?: string;
  charter?: string;
  notes_md?: string;
}

async function getSessionOr404(
  id: string,
  projectId: string,
  supabase: ReturnType<typeof adminClient>
) {
  const { data } = await supabase
    .from('exploratory_sessions')
    .select('*')
    .eq('id', id)
    .eq('project_id', projectId)
    .single();
  if (!data) throw error(404, 'exploratory session not found');
  return data as Record<string, unknown>;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const session = await getSessionOr404(params.id!, project.id, supabase);
  return json(session);
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  await getSessionOr404(params.id!, project.id, supabase);

  const body = await parseBody<SessionUpdateIn>(request);
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.title !== undefined) {
    const title = body.title.trim();
    if (!title) throw error(400, 'title is required');
    updates.title = title;
  }
  if (body.charter !== undefined) updates.charter = body.charter;
  if (body.notes_md !== undefined) updates.notes_md = body.notes_md;

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update(updates)
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  await getSessionOr404(params.id!, project.id, supabase);

  const { error: dbError } = await supabase
    .from('exploratory_sessions')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
