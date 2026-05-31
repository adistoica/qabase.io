import { adminClient } from '$lib/server/supabase';
import { json, error } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params }) => {
  const supabase = adminClient();

  const { data: shareToken } = await supabase
    .from('share_tokens')
    .select('kind, target_id, expires_at, revoked')
    .eq('token', params.token)
    .single();

  if (!shareToken || shareToken.revoked) throw error(404, 'share not found');

  if (shareToken.expires_at && new Date(shareToken.expires_at) < new Date()) {
    throw error(410, 'share expired');
  }

  if (shareToken.kind !== 'run' || !shareToken.target_id) {
    throw error(400, 'not a run share');
  }

  const { data: run } = await supabase
    .from('runs')
    .select('name, status, summary, started_at, finished_at, results')
    .eq('id', shareToken.target_id)
    .single();

  if (!run) throw error(404, 'run not found');

  const results = (run.results as Record<string, unknown>[]) ?? [];

  return json({
    name: run.name,
    status: run.status,
    summary: run.summary,
    started_at: run.started_at,
    finished_at: run.finished_at,
    results: results.map((r) => ({
      code: r.code,
      title: r.title,
      status: r.status,
      notes_md: r.notes_md
    }))
  });
};
