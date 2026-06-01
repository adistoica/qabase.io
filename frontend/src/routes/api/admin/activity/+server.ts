import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { requireOwner } from '$lib/server/permissions';
import { json } from '$lib/server/helpers';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
  const user = await getAuthUser(request);
  requireOwner(user);

  const supabase = adminClient();

  const { data: events } = await supabase
    .from('audit_events')
    .select('id, action, created_at, actor_id, project_id')
    .order('created_at', { ascending: false })
    .limit(30);

  // Resolve actor emails in a second query to avoid FK name guessing
  const actorIds = [...new Set((events ?? []).map((e: any) => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length
    ? await supabase.from('users').select('id, email, display_name').in('id', actorIds)
    : { data: [] };

  const actorMap: Record<string, { email: string; display_name: string }> = {};
  for (const a of actors ?? []) actorMap[a.id] = { email: a.email, display_name: a.display_name };

  type EventRow = { id: string; action: string; created_at: string; actor_id: string | null; project_id: string | null };
  const result = (events ?? []).map((e: EventRow) => ({
    id:          e.id,
    action:      e.action,
    created_at:  e.created_at,
    actor_id:    e.actor_id,
    project_id:  e.project_id,
    actor_email: e.actor_id ? (actorMap[e.actor_id]?.email ?? null) : null,
    actor_name:  e.actor_id ? (actorMap[e.actor_id]?.display_name ?? null) : null,
  }));

  return json(result);
};
