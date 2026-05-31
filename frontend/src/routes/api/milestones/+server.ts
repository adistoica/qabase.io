import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface MilestoneIn {
  name: string;
  description?: string;
  due_at?: string | null;
  status?: string;
}

async function decorateWithStats(
  milestone: Record<string, unknown>,
  projectId: string,
  supabase: ReturnType<typeof adminClient>
) {
  const { data } = await supabase
    .rpc('milestone_stats', { p_project_id: projectId, p_milestone_id: milestone.id });

  if (data?.[0]) {
    const row = data[0] as { total: number; passed: number };
    return {
      ...milestone,
      runs_total: row.total ?? 0,
      runs_passed: row.passed ?? 0,
      pass_rate: row.total ? row.passed / row.total : 0.0
    };
  }
  return { ...milestone, runs_total: 0, runs_passed: 0, pass_rate: 0.0 };
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const status = url.searchParams.get('status');

  let query = supabase
    .from('milestones')
    .select('*')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);

  const decorated = await Promise.all(
    (data ?? []).map((m) => decorateWithStats(m, project.id, supabase))
  );
  return json(decorated);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<MilestoneIn>(request);

  const { data, error: dbError } = await supabase
    .from('milestones')
    .insert({
      project_id: project.id,
      name: body.name,
      description: body.description ?? '',
      due_at: body.due_at ?? null,
      status: body.status ?? 'open'
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const decorated = await decorateWithStats(data, project.id, supabase);
  return json(decorated, 201);
};
