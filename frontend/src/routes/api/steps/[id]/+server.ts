import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface StepIn {
  title: string;
  body_md?: string;
  expected_md?: string;
  tags?: string[];
}

export const PUT: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<StepIn>(request);

  const { data: existing } = await supabase
    .from('steps')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'step not found');

  const { data, error: dbError } = await supabase
    .from('steps')
    .update({
      title: body.title,
      body_md: body.body_md ?? '',
      expected_md: body.expected_md ?? '',
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
  requireQa(user, project);

  const { data: existing } = await supabase
    .from('steps')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!existing) throw error(404, 'step not found');

  const { error: dbError } = await supabase
    .from('steps')
    .delete()
    .eq('id', params.id)
    .eq('project_id', project.id);

  if (dbError) throw error(500, dbError.message);
  return new Response(null, { status: 204 });
};
