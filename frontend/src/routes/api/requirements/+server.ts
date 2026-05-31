import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireManager } from '$lib/server/permissions';
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

  return {
    ...req,
    case_count: caseIds.length,
    last_status: lastStatus,
    pass_rate: passRate
  };
}

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('requirements')
    .select('*')
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);

  const decorated = await Promise.all(
    (data ?? []).map((r) => decorateRequirement(r, project.id, supabase))
  );
  return json(decorated);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const body = await parseBody<RequirementIn>(request);
  const caseIds = body.case_ids ?? [];

  const { data, error: dbError } = await supabase
    .from('requirements')
    .insert({
      project_id: project.id,
      external_id: body.external_id ?? '',
      title: body.title,
      description: body.description ?? '',
      url: body.url ?? '',
      source: body.source ?? 'manual',
      case_ids: caseIds
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  // Back-link: add this requirement to each case's requirement_ids
  if (caseIds.length) {
    const { data: cases } = await supabase
      .from('test_cases')
      .select('id, requirement_ids')
      .in('id', caseIds)
      .eq('project_id', project.id);

    for (const c of cases ?? []) {
      const ids: string[] = c.requirement_ids ?? [];
      if (!ids.includes(data.id)) {
        await supabase
          .from('test_cases')
          .update({ requirement_ids: [...ids, data.id] })
          .eq('id', c.id);
      }
    }
  }

  const decorated = await decorateRequirement(data, project.id, supabase);
  return json(decorated, 201);
};
