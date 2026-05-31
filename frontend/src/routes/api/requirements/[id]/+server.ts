import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireManager } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface RequirementIn {
  external_id?: string;
  title: string;
  description?: string;
  url?: string;
  source?: string;
  case_ids?: string[];
}

async function decorateRequirement(
  req: Record<string, unknown>,
  projectId: string,
  supabase: ReturnType<typeof adminClient>
) {
  const caseIds = (req.case_ids as string[]) ?? [];
  if (!caseIds.length) {
    return { ...req, case_count: 0, last_status: null, pass_rate: 0 };
  }

  const { data: statusData } = await supabase.rpc('requirement_last_status', {
    p_project_id: projectId,
    p_case_ids: caseIds
  });

  const rows = (statusData ?? []) as Record<string, unknown>[];
  const lastStatus = rows.length > 0 ? (rows[0].status as string) : null;
  const passed = rows.filter((r) => r.status === 'passed').length;
  const passRate = rows.length ? passed / rows.length : 0;

  return { ...req, case_count: caseIds.length, last_status: lastStatus, pass_rate: passRate };
}

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<RequirementIn>(request);

  const { data: existing } = await supabase
    .from('requirements')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'requirement not found');

  const oldIds = new Set<string>(existing.case_ids ?? []);
  const newIds = new Set<string>(body.case_ids ?? []);
  const added = [...newIds].filter((id) => !oldIds.has(id));
  const removed = [...oldIds].filter((id) => !newIds.has(id));

  const { data, error: dbError } = await supabase
    .from('requirements')
    .update({
      external_id: body.external_id ?? '',
      title: body.title,
      description: body.description ?? '',
      url: body.url ?? '',
      source: body.source ?? 'manual',
      case_ids: [...newIds],
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  for (const cid of added) {
    const { data: c } = await supabase.from('test_cases').select('requirement_ids').eq('id', cid).single();
    if (c) {
      const ids: string[] = c.requirement_ids ?? [];
      if (!ids.includes(params.id!)) {
        await supabase.from('test_cases').update({ requirement_ids: [...ids, params.id!] }).eq('id', cid);
      }
    }
  }

  for (const cid of removed) {
    const { data: c } = await supabase.from('test_cases').select('requirement_ids').eq('id', cid).single();
    if (c) {
      const ids: string[] = (c.requirement_ids ?? []).filter((id: string) => id !== params.id);
      await supabase.from('test_cases').update({ requirement_ids: ids }).eq('id', cid);
    }
  }

  const decorated = await decorateRequirement(data, project.id, supabase);
  return json(decorated);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('requirements')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'requirement not found');

  for (const cid of existing.case_ids ?? []) {
    const { data: c } = await supabase.from('test_cases').select('requirement_ids').eq('id', cid).single();
    if (c) {
      const ids: string[] = (c.requirement_ids ?? []).filter((id: string) => id !== params.id);
      await supabase.from('test_cases').update({ requirement_ids: ids }).eq('id', cid);
    }
  }

  const { error: dbError } = await supabase
    .from('requirements')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
