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

  const { data: session } = await supabase
    .from('exploratory_sessions')
    .select('screenshots')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');

  const screenshot = (session.screenshots as Record<string, unknown>[])?.find(
    (s) => s.id === params.screenshotId
  );
  if (!screenshot) throw error(404, 'screenshot not found');

  const { data: urlData, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(screenshot.storage_key as string, 3600);

  if (urlError) throw error(500, urlError.message);
  return Response.redirect(urlData.signedUrl, 302);
};
