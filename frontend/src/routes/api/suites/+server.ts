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

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('suites')
    .select('*')
    .eq('project_id', project.id)
    .order('position');

  if (dbError) throw error(500, dbError.message);

  const out = await Promise.all(
    (data ?? []).map(async (s) => {
      const cases = await resolveSuiteCases(s, supabase);
      return { ...s, case_count: cases.length };
    })
  );

  return json(out);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<SuiteIn>(request);
  const parentId = body.parent_id ?? null;
  const position = await nextSuitePosition(project.id, parentId, supabase);

  const { data, error: dbError } = await supabase
    .from('suites')
    .insert({
      project_id: project.id,
      name: body.name,
      parent_id: parentId,
      position,
      type: body.type ?? 'static',
      static_case_ids: body.static_case_ids ?? [],
      filter: body.filter ?? {},
      description: body.description ?? ''
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  const cases = await resolveSuiteCases(data, supabase);
  return json({ ...data, case_count: cases.length }, 201);
};
