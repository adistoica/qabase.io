import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer, requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

interface CommentIn {
  target_kind: string;
  target_id: string;
  body_md: string;
}

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g;

async function resolveMentions(
  body: string,
  supabase: ReturnType<typeof adminClient>
): Promise<string[]> {
  const handles = [...body.matchAll(MENTION_RE)].map((m) => m[1]);
  if (!handles.length) return [];

  const { data } = await supabase
    .from('users')
    .select('id, email, display_name')
    .or(
      handles
        .map((h) => `email.ilike.${h}@%,display_name.eq.${h}`)
        .join(',')
    );

  return (data ?? []).map((u) => u.id as string);
}

export const GET: RequestHandler = async ({ request, url }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const targetKind = url.searchParams.get('target_kind');
  const targetId = url.searchParams.get('target_id');
  if (!targetKind || !targetId) throw error(400, 'target_kind and target_id are required');

  const { data, error: dbError } = await supabase
    .from('comments')
    .select('*, author:users!author_id(id, display_name, email)')
    .eq('project_id', project.id)
    .eq('target_kind', targetKind)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true });

  if (dbError) throw error(500, dbError.message);

  const out = (data ?? []).map((c) => {
    const author = c.author as Record<string, string> | null;
    return {
      id: c.id,
      target_kind: c.target_kind,
      target_id: c.target_id,
      author_id: c.author_id,
      author_display_name: author?.display_name ?? '',
      author_email: author?.email ?? '',
      body_md: c.body_md,
      mentions: c.mentions ?? [],
      created_at: c.created_at,
      edited_at: c.edited_at
    };
  });

  return json(out);
};

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<CommentIn>(request);
  const mentions = await resolveMentions(body.body_md ?? '', supabase);

  const { data, error: dbError } = await supabase
    .from('comments')
    .insert({
      project_id: project.id,
      target_kind: body.target_kind,
      target_id: body.target_id,
      author_id: user.id,
      body_md: body.body_md,
      mentions
    })
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);

  return json(
    {
      id: data.id,
      target_kind: data.target_kind,
      target_id: data.target_id,
      author_id: data.author_id,
      author_display_name: user.display_name,
      author_email: user.email,
      body_md: data.body_md,
      mentions: data.mentions ?? [],
      created_at: data.created_at,
      edited_at: data.edited_at
    },
    201
  );
};
