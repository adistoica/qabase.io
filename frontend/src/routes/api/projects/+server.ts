import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface ProjectIn {
  slug: string;
  name: string;
  code_prefix?: string;
  description?: string;
}

export const GET: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const { data, error: dbError } = await supabase.from('projects').select('*');
  if (dbError) throw error(500, dbError.message);

  const projects = (data ?? []).filter((p) => {
    if (user.roles.includes('admin')) return true;
    return user.id in (p.role_overrides ?? {});
  });

  return json(projects);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);

  const body = await parseBody<ProjectIn>(request);

  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .eq('slug', body.slug)
    .single();

  if (existing) throw error(400, 'slug already taken');

  const { data, error: dbError } = await supabase
    .from('projects')
    .insert({
      slug: body.slug,
      name: body.name,
      code_prefix: body.code_prefix ?? 'TP',
      description: body.description ?? '',
      role_overrides: { [user.id]: ['admin'] }
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  audit({
    actorId: user.id,
    projectId: data.id,
    action: 'project.created',
    targetKind: 'project',
    targetId: data.id,
    payload: { slug: data.slug }
  });

  return json(data, 201);
};
