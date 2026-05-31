import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data: runs, error: dbError } = await supabase
    .from('runs')
    .select('id, name, results')
    .eq('project_id', project.id)
    .eq('status', 'in_progress')
    .limit(200);

  if (dbError) throw error(500, dbError.message);

  const queue: unknown[] = [];
  for (const run of runs ?? []) {
    const results = (run.results ?? []) as Record<string, unknown>[];
    results.forEach((result, idx) => {
      if (
        result.assigned_to === user.id &&
        (result.status === 'pending' || result.status === 'blocked')
      ) {
        queue.push({
          run_id: run.id,
          run_name: run.name,
          result_index: idx,
          title: result.title,
          code: result.code,
          status: result.status
        });
      }
    });
  }

  return json(queue);
};
