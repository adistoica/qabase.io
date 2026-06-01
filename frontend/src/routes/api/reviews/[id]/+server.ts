import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa, userRolesInProject } from '$lib/server/permissions';
import { error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: review } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!review) throw error(404, 'review not found');
  if (review.status !== 'pending') throw error(409, 'only pending reviews can be cancelled');

  const isOwner = review.submitted_by === user.id;
  const projectRoles = userRolesInProject(user, project);
  const isManager =
    user.roles.includes('owner') ||
    projectRoles.includes('manager') ||
    projectRoles.includes('admin');

  if (!isOwner && !isManager) throw error(403, 'can only cancel your own reviews');

  await supabase
    .from('test_cases')
    .update({ review_status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', review.test_case_id);

  const { error: dbError } = await supabase
    .from('reviews')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
