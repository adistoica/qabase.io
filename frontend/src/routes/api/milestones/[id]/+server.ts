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

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('milestones')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (dbError || !data) throw error(404, 'milestone not found');
  const decorated = await decorateWithStats(data, project.id, supabase);
  return json(decorated);
};

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<MilestoneIn>(request);

  const { data: existing } = await supabase
    .from('milestones')
    .select('status')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'milestone not found');

  const update: Record<string, unknown> = {
    name: body.name,
    description: body.description ?? '',
    due_at: body.due_at ?? null,
    status: body.status ?? 'open'
  };

  if (body.status === 'closed' && existing.status !== 'closed') {
    update.closed_at = new Date().toISOString();
  }

  const { data, error: dbError } = await supabase
    .from('milestones')
    .update(update)
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  const decorated = await decorateWithStats(data, project.id, supabase);
  return json(decorated);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('milestones')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'milestone not found');

  const { error: dbError } = await supabase
    .from('milestones')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
