import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject, nextCaseCode } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface QuickCaseIn {
  title: string;
  priority?: string;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<QuickCaseIn>(request);

  const { data: suite } = await supabase
    .from('suites')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!suite) throw error(404, 'suite not found');

  const code = await nextCaseCode(project.id, supabase);
  const now = new Date().toISOString();

  const { data: newCase, error: dbError } = await supabase
    .from('test_cases')
    .insert({
      project_id: project.id,
      code,
      title: body.title,
      priority: body.priority ?? 'P2',
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
    priority: newCase.priority,
    author_id: user.id,
    change_note: 'initial',
    created_at: now
  });

  if (suite.type === 'static') {
    const ids = [...(suite.static_case_ids ?? []), newCase.id];
    await supabase
      .from('suites')
      .update({ static_case_ids: ids, updated_at: now })
      .eq('id', params.id);
  }

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'case.created',
    targetKind: 'case',
    targetId: newCase.id,
    payload: { code }
  });

  return json(
    { id: newCase.id, code, title: newCase.title, priority: newCase.priority },
    201
  );
};
