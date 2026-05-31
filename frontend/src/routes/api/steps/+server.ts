import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface StepIn {
  title: string;
  body_md?: string;
  expected_md?: string;
  tags?: string[];
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const tag = url.searchParams.getAll('tag');
  const limit = parseInt(url.searchParams.get('limit') ?? '200');

  let query = supabase
    .from('steps')
    .select('*')
    .eq('project_id', project.id)
    .limit(limit);

  if (tag.length > 0) {
    query = query.overlaps('tags', tag);
  }

  const { data, error: dbError } = await query;
  if (dbError) throw error(500, dbError.message);
  return json(data);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<StepIn>(request);

  const { data, error: dbError } = await supabase
    .from('steps')
    .insert({
      project_id: project.id,
      owner_id: user.id,
      title: body.title,
      body_md: body.body_md ?? '',
      expected_md: body.expected_md ?? '',
      tags: body.tags ?? []
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data, 201);
};
