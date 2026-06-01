import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: comment } = await supabase
    .from('comments')
    .select('author_id, project_id')
    .eq('id', params.id)
    .single();

  if (!comment || comment.project_id !== project.id) throw error(404, 'comment not found');

  if (comment.author_id !== user.id && !user.roles?.includes('owner')) {
    throw error(403, 'only the author or the organisation owner can delete');
  }

  const { error: dbError } = await supabase.from('comments').delete().eq('id', params.id);
  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
