import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface DefectIn {
  title: string;
  description_md?: string;
  severity?: string;
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const status = url.searchParams.get('status');
  const severity = url.searchParams.get('severity');

  let query = supabase
    .from('defects')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (severity) query = query.eq('severity', severity);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<DefectIn>(request);

  const { data, error: dbError } = await supabase
    .from('defects')
    .insert({
      project_id: project.id,
      title: body.title,
      description_md: body.description_md ?? '',
      severity: body.severity ?? 'medium',
      reported_by: user.id
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'defect.created',
    targetKind: 'defect',
    targetId: data.id,
    payload: { title: body.title }
  });

  return json(data, 201);
};
