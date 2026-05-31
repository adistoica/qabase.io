import { adminClient } from './supabase';

export async function audit(opts: {
  actorId?: string;
  projectId?: string;
  action: string;
  targetKind?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
  ip?: string;
}): Promise<void> {
  try {
    await adminClient()
      .from('audit_events')
      .insert({
        actor_id: opts.actorId ?? null,
        project_id: opts.projectId ?? null,
        action: opts.action,
        target_kind: opts.targetKind ?? '',
        target_id: opts.targetId ?? null,
        payload: opts.payload ?? {},
        ip: opts.ip ?? ''
      });
  } catch {
    // Audit must never break the request path.
  }
}
