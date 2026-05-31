import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { resolveSuiteCases, nextSuitePosition } from '$lib/server/suite-utils';
import type { RequestHandler } from '@sveltejs/kit';

interface SuiteIn {
  name: string;
  parent_id?: string | null;
  type?: string;
  static_case_ids?: string[];
  filter?: Record<string, unknown>;
  description?: string;
}

async function getSuite(suiteId: string, projectId: string, supabase: ReturnType<typeof adminClient>) {
  const { data } = await supabase
    .from('suites')
    .select('*')
    .eq('id', suiteId)
    .eq('project_id', projectId)
    .single();
  return data;
}

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const suite = await getSuite(params.id!, project.id, supabase);
  if (!suite) throw error(404, 'suite not found');

  const cases = await resolveSuiteCases(suite, supabase);
  return json({ ...suite, case_count: cases.length });
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<SuiteIn>(request);
  const existing = await getSuite(params.id!, project.id, supabase);
  if (!existing) throw error(404, 'suite not found');

  const newParent = body.parent_id ?? null;
  const update: Record<string, unknown> = {
    name: body.name,
    type: body.type ?? 'static',
    static_case_ids: body.static_case_ids ?? [],
    filter: body.filter ?? {},
    description: body.description ?? '',
    updated_at: new Date().toISOString()
  };

  if (newParent !== existing.parent_id) {
    update.parent_id = newParent;
    update.position = await nextSuitePosition(project.id, newParent, supabase);
  }

  const { data, error: dbError } = await supabase
    .from('suites')
    .update(update)
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  const cases = await resolveSuiteCases(data, supabase);
  return json({ ...data, case_count: cases.length });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const suite = await getSuite(params.id!, project.id, supabase);
  if (!suite) throw error(404, 'suite not found');

  // Reparent children to this suite's parent
  await supabase
    .from('suites')
    .update({ parent_id: suite.parent_id })
    .eq('parent_id', params.id)
    .eq('project_id', project.id);

  const { error: dbError } = await supabase
    .from('suites')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
