import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data, error: dbError } = await supabase
    .from('test_cases')
    .update({ archived: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError || !data) throw error(404, 'case not found');
  return json(data);
};
