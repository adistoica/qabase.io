import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface CaseIn {
  title: string;
  priority?: string;
  component?: string;
  tags?: string[];
  description_md?: string;
  preconditions_md?: string;
  steps?: unknown[];
  custom_fields?: Record<string, unknown>;
  requirement_ids?: string[];
  change_note?: string;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('test_cases')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !data) throw error(404, 'case not found');
  return json(data);
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<CaseIn>(request);

  const { data: existing } = await supabase
    .from('test_cases')
    .select('current_revision')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'case not found');

  const now = new Date().toISOString();
  const nextRevision = (existing.current_revision ?? 1) + 1;

  const { data, error: dbError } = await supabase
    .from('test_cases')
    .update({
      title: body.title,
      priority: body.priority ?? 'P2',
      component: body.component ?? '',
      tags: body.tags ?? [],
      description_md: body.description_md ?? '',
      preconditions_md: body.preconditions_md ?? '',
      steps: body.steps ?? [],
      custom_fields: body.custom_fields ?? {},
      requirement_ids: body.requirement_ids ?? [],
      current_revision: nextRevision,
      updated_at: now
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  await supabase.from('test_case_revisions').insert({
    test_case_id: params.id,
    project_id: project.id,
    revision: nextRevision,
    title: body.title,
    description_md: body.description_md ?? '',
    preconditions_md: body.preconditions_md ?? '',
    steps: body.steps ?? [],
    priority: body.priority ?? 'P2',
    component: body.component ?? '',
    tags: body.tags ?? [],
    custom_fields: body.custom_fields ?? {},
    requirement_ids: body.requirement_ids ?? [],
    author_id: user.id,
    change_note: body.change_note ?? '',
    created_at: now
  });

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'case.updated',
    targetKind: 'case',
    targetId: params.id,
    payload: { revision: nextRevision }
  });

  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: existing } = await supabase
    .from('test_cases')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'case not found');

  await supabase
    .from('test_case_revisions')
    .delete()
    .eq('test_case_id', params.id);

  const { error: dbError } = await supabase
    .from('test_cases')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'case.deleted',
    targetKind: 'case',
    targetId: params.id
  });

  return new Response(null, { status: 204 });
};
