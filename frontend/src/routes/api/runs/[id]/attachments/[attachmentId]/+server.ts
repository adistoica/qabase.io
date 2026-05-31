import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireViewer } from '$lib/server/permissions';
import { error } from '$lib/server/helpers';
import { STORAGE_BUCKET } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireViewer(user, project);

  const { data: run } = await supabase
    .from('runs')
    .select('id')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!run) throw error(404, 'run not found');

  const { data: att } = await supabase
    .from('attachments')
    .select('storage_key')
    .eq('id', params.attachmentId)
    .eq('run_id', params.id)
    .single();

  if (!att) throw error(404, 'attachment not found');

  const { data: urlData, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(att.storage_key as string, 3600);

  if (urlError) throw error(500, urlError.message);
  return Response.redirect(urlData.signedUrl, 302);
};
