import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

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
    (data ?? []).map(async (r) => {
      const caseIds = (r.case_ids as string[]) ?? [];
      if (!caseIds.length) {
        return { ...r, case_count: 0, last_status: null, pass_rate: 0 };
      }

      const { data: statusData } = await supabase.rpc('requirement_last_status', {
        p_project_id: project.id,
        p_case_ids: caseIds
      });

      const rows = (statusData ?? []) as Record<string, unknown>[];
      const lastStatus = rows.length > 0 ? (rows[0].status as string) : null;
      const passed = rows.filter((row) => row.status === 'passed').length;
      const passRate = rows.length ? passed / rows.length : 0;

      return { ...r, case_count: caseIds.length, last_status: lastStatus, pass_rate: passRate };
    })
  );

  return json(decorated);
};
