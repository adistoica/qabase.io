import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface ReviewIn {
  test_case_id: string;
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const status = url.searchParams.get('status');
  const submittedBy = url.searchParams.get('submitted_by');

  let query = supabase
    .from('reviews')
    .select('*')
    .eq('project_id', project.id)
    .order('submitted_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (submittedBy) query = query.eq('submitted_by', submittedBy);

  const { data: reviews, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  const caseIds = [...new Set((reviews ?? []).map((r) => r.test_case_id))];
  const { data: cases } = caseIds.length
    ? await supabase.from('test_cases').select('id, code, title').in('id', caseIds)
    : { data: [] };

  const caseMap = new Map((cases ?? []).map((c) => [c.id, c]));

  const out = (reviews ?? []).map((r) => {
    const tc = caseMap.get(r.test_case_id);
    return {
      ...r,
      case_code: tc?.code ?? '',
      case_title: tc?.title ?? '(deleted)'
    };
  });

  return json(out);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<ReviewIn>(request);

  const { data: tc } = await supabase
    .from('test_cases')
    .select('*')
    .eq('id', body.test_case_id)
    .eq('project_id', project.id)
    .single();

  if (!tc) throw error(404, 'test case not found');
  if (tc.review_status === 'in_review') throw error(409, 'test case already has a pending review');

  const now = new Date().toISOString();

  const { data: review, error: dbError } = await supabase
    .from('reviews')
    .insert({
      project_id: project.id,
      test_case_id: body.test_case_id,
      submitted_by: user.id,
      submitted_at: now
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  await supabase
    .from('test_cases')
    .update({ review_status: 'in_review', updated_at: now })
    .eq('id', body.test_case_id);

  audit({
    actorId: user.id,
    projectId: project.id,
    action: 'review.submitted',
    targetKind: 'review',
    targetId: review.id,
    payload: { test_case_id: body.test_case_id }
  });

  return json({ ...review, case_code: tc.code, case_title: tc.title }, 201);
};
