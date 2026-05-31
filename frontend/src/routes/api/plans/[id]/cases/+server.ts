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

  const { data: plan, error: dbError } = await supabase
    .from('test_plans')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !plan) throw error(404, 'plan not found');

  const seen = new Map<string, Record<string, unknown>>();

  if (plan.extra_case_ids?.length) {
    const { data: extras } = await supabase
      .from('test_cases')
      .select('id, code, title, priority, component, tags')
      .eq('project_id', project.id)
      .in('id', plan.extra_case_ids);
    for (const c of extras ?? []) seen.set(c.id as string, c);
  }

  for (const sid of plan.suite_ids ?? []) {
    const { data: suite } = await supabase
      .from('suites')
      .select('*')
      .eq('id', sid)
      .eq('project_id', project.id)
      .single();
    if (suite) {
      const cases = await resolveSuiteCases(suite, supabase);
      for (const c of cases) {
        seen.set(c.id as string, {
          id: c.id,
          code: c.code,
          title: c.title,
          priority: c.priority,
          component: c.component,
          tags: c.tags
        });
      }
    }
  }

  return json(Array.from(seen.values()));
};
