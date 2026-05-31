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

  const { data, error: rpcError } = await supabase.rpc('dashboard_flakiness', {
    p_project_id: project.id
  });

  if (rpcError) throw error(500, rpcError.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  return json(
    rows.map((r) => ({
      ...r,
      flakiness: r.runs ? Number(r.failed) / Number(r.runs) : 0
    }))
  );
};
