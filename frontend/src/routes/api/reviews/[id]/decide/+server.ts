import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface DecideIn {
  decision: 'approved' | 'rejected';
  note?: string;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<DecideIn>(request);

  const { data: review } = await supabase
    .from('reviews')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!review) throw error(404, 'review not found');
  if (review.status !== 'pending') throw error(409, 'review already decided');

  const now = new Date().toISOString();

  const { data: updated } = await supabase
    .from('reviews')
    .update({
      status: body.decision,
      reviewed_by: user.id,
      note: body.note ?? '',
      decided_at: now
    })
    .eq('id', params.id)
    .select()
    .single();

  const { data: tc } = await supabase
    .from('test_cases')
    .select('id, code, title')
    .eq('id', review.test_case_id)
    .single();

  if (tc) {
    await supabase
      .from('test_cases')
      .update({ review_status: body.decision, updated_at: now })
      .eq('id', review.test_case_id);
  }

  audit({
    actorId: user.id,
    projectId: project.id,
    action: `review.${body.decision}`,
    targetKind: 'review',
    targetId: params.id,
    payload: { note: body.note ?? '' }
  });

  return json({
    ...(updated ?? review),
    case_code: tc?.code ?? '',
    case_title: tc?.title ?? '(deleted)'
  });
};
