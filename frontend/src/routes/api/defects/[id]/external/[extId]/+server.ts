import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: defect } = await supabase
    .from('defects')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!defect) throw error(404, 'defect not found');

  const links = (defect.external_links ?? []).filter(
    (l: Record<string, unknown>) => l.external_id !== params.extId
  );

  const { data, error: dbError } = await supabase
    .from('defects')
    .update({ external_links: links, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};
