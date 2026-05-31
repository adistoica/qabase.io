import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface ExternalLinkIn {
  system: string;
  external_id: string;
  url?: string;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<ExternalLinkIn>(request);

  const { data: defect } = await supabase
    .from('defects')
    .select('*')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!defect) throw error(404, 'defect not found');

  const links: Record<string, unknown>[] = defect.external_links ?? [];
  const already = links.some(
    (l) => l.external_id === body.external_id && l.system === body.system
  );

  if (!already) {
    links.push({
      system: body.system,
      external_id: body.external_id,
      url: body.url ?? '',
      sync_state: 'unsynced',
      opened_at: new Date().toISOString()
    });
    const { data, error: dbError } = await supabase
      .from('defects')
      .update({ external_links: links, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('project_id', project.id)
      .select()
      .single();
    if (dbError) throw error(500, dbError.message);
    return json(data);
  }

  return json(defect);
};
