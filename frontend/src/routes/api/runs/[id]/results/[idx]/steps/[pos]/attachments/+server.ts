import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error } from '$lib/server/helpers';
import { STORAGE_BUCKET } from '$env/static/private';
import type { RequestHandler } from '@sveltejs/kit';

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8'
};

export const POST: RequestHandler = async ({ request, params }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const { data: run } = await supabase
    .from('runs')
    .select('results')
    .eq('id', params.id)
    .eq('project_id', project.id)
    .single();

  if (!run) throw error(404, 'run not found');

  const results = (run.results as Record<string, unknown>[]) ?? [];
  const resultIndex = Number(params.idx);
  const stepPosition = Number(params.pos);

  if (resultIndex < 0 || resultIndex >= results.length) throw error(400, 'result index out of range');
  const result = results[resultIndex] as Record<string, unknown>;
  const stepResults = (result.step_results as Record<string, unknown>[]) ?? [];
  if (stepPosition < 0 || stepPosition >= stepResults.length) throw error(400, 'step position out of range');

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) throw error(400, 'no file uploaded');
  if (file.size > MAX_BYTES) throw error(413, 'file too large (max 25 MB)');

  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const safeMime = ALLOWED_MIME[ext] ?? 'application/octet-stream';
  const storageName = `${crypto.randomUUID().replace(/-/g, '')}${ext ? '.' + ext : ''}`;
  const storageKey = `${project.id}/${params.id}/${storageName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, file, { contentType: safeMime });

  if (uploadError) throw error(500, uploadError.message);

  const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
  const kind = imageExts.has(ext) ? 'screenshot' : 'other';

  const { data: att, error: dbError } = await supabase
    .from('attachments')
    .insert({
      run_id: params.id,
      result_position: resultIndex,
      step_position: stepPosition,
      kind,
      storage_key: storageKey,
      mime: safeMime,
      size: file.size,
      original_name: file.name,
      uploaded_by: user.id
    })
    .select('id, kind, mime, size, original_name')
    .single();

  if (dbError) throw error(500, dbError.message);

  const step = stepResults[stepPosition] as Record<string, unknown>;
  const attachmentIds: string[] = (step.attachment_ids as string[]) ?? [];
  attachmentIds.push(att.id as string);
  stepResults[stepPosition] = { ...step, attachment_ids: attachmentIds };
  results[resultIndex] = { ...result, step_results: stepResults };

  await supabase.from('runs').update({ results }).eq('id', params.id);

  return json(att, 201);
};
