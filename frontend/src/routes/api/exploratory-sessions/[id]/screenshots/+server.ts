import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import { STORAGE_BUCKET } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const MAX_BYTES = 25 * 1024 * 1024;

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: session } = await supabase
    .from('exploratory_sessions')
    .select('screenshots')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!session) throw error(404, 'exploratory session not found');

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) throw error(400, 'no file uploaded');
  if (file.size > MAX_BYTES) throw error(413, 'file too large (max 25 MB)');

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const storageId = crypto.randomUUID().replace(/-/g, '');
  const storageName = ext ? `${storageId}.${ext}` : storageId;
  const storageKey = `${project.id}/exploratory/${params.id}/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, file, { contentType: file.type || 'application/octet-stream' });

  if (uploadError) throw error(500, uploadError.message);

  const screenshots: Record<string, unknown>[] =
    (session.screenshots as Record<string, unknown>[]) ?? [];
  screenshots.push({
    id: storageId,
    storage_key: storageKey,
    mime: file.type || 'application/octet-stream',
    size: file.size,
    original_name: file.name,
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString()
  });

  const { data, error: dbError } = await supabase
    .from('exploratory_sessions')
    .update({ screenshots, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('project_id', project.id)
    .select()
    .single();

  if (dbError) throw error(500, dbError.message);
  return json(data, 201);
};
