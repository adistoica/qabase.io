import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface ProjectUpdate {
  name?: string;
  description?: string;
  custom_fields?: unknown[];
  integrations?: Record<string, string>;
  ai?: Record<string, unknown>;
  role_overrides?: Record<string, string[]>;
}

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const body = await parseBody<ProjectUpdate>(request);

  const { data: existing } = await supabase
    .from('projects')
    .select('id, role_overrides')
    .eq('id', params.id)
    .single();

  if (!existing) throw error(404, 'project not found');

  const projectRoles: string[] = (existing.role_overrides as Record<string, string[]>)?.[user.id] ?? [];
  const isProjectAdmin = projectRoles.includes('admin');
  if (!user.roles.includes('admin') && !isProjectAdmin) throw error(403, 'admin only');

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.custom_fields !== undefined) update.custom_fields = body.custom_fields;
  if (body.integrations !== undefined) update.integrations = body.integrations;
  if (body.ai !== undefined) update.ai = body.ai;
  if (body.role_overrides !== undefined) update.role_overrides = body.role_overrides;

  const { data, error: dbError } = await supabase
    .from('projects')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: params.id,
    action: 'project.updated',
    targetKind: 'project',
    targetId: params.id
  });

  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const { data: existing } = await supabase
    .from('projects')
    .select('id, slug, role_overrides')
    .eq('id', params.id)
    .single();

  if (!existing) throw error(404, 'project not found');

  const projectRoles: string[] = (existing.role_overrides as Record<string, string[]>)?.[user.id] ?? [];
  const isProjectAdmin = projectRoles.includes('admin');
  if (!user.roles.includes('admin') && !isProjectAdmin) throw error(403, 'admin only');

  const { data: allProjects } = await supabase.from('projects').select('id');
  if ((allProjects?.length ?? 0) <= 1) {
    throw error(400, 'cannot delete the only project');
  }

  for (const table of [
    'test_cases',
    'test_case_revisions',
    'runs',
    'suites',
    'reviews',
    'environments',
    'defects',
    'milestones',
    'test_plans',
    'requirements',
    'steps',
    'share_tokens'
  ]) {
    await supabase.from(table).delete().eq('project_id', params.id);
  }

  audit({
    actorId: user.id,
    projectId: params.id,
    action: 'project.deleted',
    targetKind: 'project',
    targetId: params.id,
    payload: { slug: existing.slug }
  });

  const { error: dbError } = await supabase.from('projects').delete().eq('id', params.id);
  if (dbError) throw error(500, dbError.message);

  return new Response(null, { status: 204 });
};
