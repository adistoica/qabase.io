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

  const { data, error: dbError } = await supabase
    .from('comments')
    .select('*, author:users!author_id(id, display_name, email)')
    .eq('project_id', project.id)
    .contains('mentions', [user.id])
    .order('created_at', { ascending: false })
    .limit(50);

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
