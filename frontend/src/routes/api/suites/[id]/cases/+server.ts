import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import { resolveSuiteCases } from '$lib/server/suite-utils';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data: suite } = await supabase
    .from('suites')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!suite) throw error(404, 'suite not found');

  const cases = await resolveSuiteCases(suite, supabase);
  return json(
    cases.map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      priority: c.priority,
      component: c.component,
      tags: c.tags
    }))
  );
};
