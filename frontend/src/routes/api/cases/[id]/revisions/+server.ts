import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('test_case_revisions')
    .select('revision, title, change_note, author_id, created_at')
    .eq('test_case_id', params.id)
    .order('revision', { ascending: false });

  if (dbError) throw error(500, dbError.message);
  return json(data ?? []);
};
