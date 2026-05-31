import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa, requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface DefectUpdateIn {
  title?: string;
  description_md?: string;
  status?: string;
  severity?: string;
  assigned_to?: string | null;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('defects')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !data) throw error(404, 'defect not found');
  return json(data);
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<DefectUpdateIn>(request);

  const { data: existing } = await supabase
    .from('defects')
    .select('status')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'defect not found');

  const oldStatus = existing.status;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.title !== undefined) update.title = body.title;
  if (body.description_md !== undefined) update.description_md = body.description_md;
  if (body.status !== undefined) update.status = body.status;
  if (body.severity !== undefined) update.severity = body.severity;
  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to;

  const { data, error: dbError } = await supabase
    .from('defects')
    .update(update)
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  if (body.status && body.status !== oldStatus) {
    audit({
      actorId: user.id,
      projectId: project.id,
      action: 'defect.status_changed',
      targetKind: 'defect',
      targetId: params.id,
      payload: { from: oldStatus, to: body.status }
    });
  }

  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('defects')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'defect not found');

  const { error: dbError } = await supabase
    .from('defects')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
