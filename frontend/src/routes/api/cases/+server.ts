import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { nextCaseCode } from '$lib/server/projects';
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

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const archived = url.searchParams.get('archived') === 'true';
  const skip = parseInt(url.searchParams.get('skip') ?? '0');
  const limit = parseInt(url.searchParams.get('limit') ?? '200');
  const component = url.searchParams.get('component');
  const tags = url.searchParams.getAll('tag');
  const priorities = url.searchParams.getAll('priority');

  let query = supabase
    .from('test_cases')
    .select('*')
    .eq('project_id', project.id)
    .eq('archived', archived)
    .range(skip, skip + limit - 1);

  if (component) query = query.eq('component', component);
  if (tags.length > 0) query = query.overlaps('tags', tags);
  if (priorities.length > 0) query = query.in('priority', priorities);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<CaseIn>(request);
  const code = await nextCaseCode(project.id, supabase);
  const now = new Date().toISOString();

  const { data: newCase, error: dbError } = await supabase
    .from('test_cases')
    .insert({
      project_id: project.id,
      code,
      title: body.title,
      priority: body.priority ?? 'P2',
      component: body.component ?? '',
      tags: body.tags ?? [],
      description_md: body.description_md ?? '',
      preconditions_md: body.preconditions_md ?? '',
      steps: body.steps ?? [],
      custom_fields: body.custom_fields ?? {},
      requirement_ids: body.requirement_ids ?? [],
      owner_id: user.id,
      current_revision: 1,
      created_at: now,
      updated_at: now
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  await supabase.from('test_case_revisions').insert({
    test_case_id: newCase.id,
    project_id: project.id,
    revision: 1,
    title: newCase.title,
    description_md: newCase.description_md,
    preconditions_md: newCase.preconditions_md,
    steps: newCase.steps,
    priority: newCase.priority,
    component: newCase.component,
    tags: newCase.tags,
    custom_fields: newCase.custom_fields,
    requirement_ids: newCase.requirement_ids,
    author_id: user.id,
    change_note: body.change_note || 'initial',
    created_at: now
  });

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'case.created',
    targetKind: 'case',
    targetId: newCase.id,
    payload: { code }
  });

  return json(newCase, 201);
};
