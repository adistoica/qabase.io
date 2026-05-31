import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface BugIn {
  title: string;
  description_md?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  external_url?: string;
}

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: session } = await supabase
    .from('exploratory_sessions')
    .select('discovered_bugs')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');

  const body = await parseBody<BugIn>(request);
  const title = body.title?.trim();
  if (!title) throw error(400, 'title is required');

  const bugs: Record<string, unknown>[] = (session.discovered_bugs as Record<string, unknown>[]) ?? [];
  const bugId = crypto.randomUUID().replace(/-/g, '');
  bugs.push({
    id: bugId,
    title,
    description_md: body.description_md ?? '',
    severity: body.severity ?? 'medium',
    external_url: body.external_url ?? '',
    created_at: new Date().toISOString()
  });

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update({ discovered_bugs: bugs, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data, 201);
};
