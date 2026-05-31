import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface EnvironmentIn {
  name: string;
  description?: string;
  browser?: string;
  os?: string;
  build?: string;
  variables?: Record<string, string>;
  tags?: string[];
}

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data, error: dbError } = await supabase
    .from('environments')
    .select('*')
    .eq('project_id', project.id)
    .order('name');

  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<EnvironmentIn>(request);

  const { data, error: dbError } = await supabase
    .from('environments')
    .insert({
      project_id: project.id,
      name: body.name,
      description: body.description ?? '',
      browser: body.browser ?? '',
      os: body.os ?? '',
      build: body.build ?? '',
      variables: body.variables ?? {},
      tags: body.tags ?? []
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data, 201);
};
