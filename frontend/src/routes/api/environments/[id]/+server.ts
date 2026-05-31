import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa, requireManager } from '$lib/server/permissions';
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

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<EnvironmentIn>(request);

  const { data: existing } = await supabase
    .from('environments')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'environment not found');

  const { data, error: dbError } = await supabase
    .from('environments')
    .update({
      name: body.name,
      description: body.description ?? '',
      browser: body.browser ?? '',
      os: body.os ?? '',
      build: body.build ?? '',
      variables: body.variables ?? {},
      tags: body.tags ?? [],
      updated_at: new Date().toISOString()
    })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const DELETE: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireManager(user, project);

  const { data: existing } = await supabase
    .from('environments')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'environment not found');

  const { error: dbError } = await supabase
    .from('environments')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
