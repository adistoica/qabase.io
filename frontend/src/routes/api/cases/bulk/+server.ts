import { adminClient } from '$lib/server/supabase';
import { getAuthUser } from '$lib/server/auth';
import { getActiveProject } from '$lib/server/projects';
import { requireQa } from '$lib/server/permissions';
import { json, error, parseBody } from '$lib/server/helpers';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from '@sveltejs/kit';

interface BulkAction {
  case_ids: string[];
  action: string;
  value?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  const supabase = adminClient();
  const user = await getAuthUser(request);
  const project = await getActiveProject(request, supabase);
  requireQa(user, project);

  const body = await parseBody<BulkAction>(request);
  const { case_ids: caseIds, action, value } = body;

  if (!caseIds?.length) return json({ updated: 0 });

  const now = new Date().toISOString();
  let affected = 0;

  switch (action) {
    case 'archive': {
      const { error: dbError } = await supabase
        .from('test_cases')
        .update({ archived: true, updated_at: now })
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (dbError) throw error(500, dbError.message);
      affected = caseIds.length;
      break;
    }
    case 'restore': {
      const { error: dbError } = await supabase
        .from('test_cases')
        .update({ archived: false, updated_at: now })
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (dbError) throw error(500, dbError.message);
      affected = caseIds.length;
      break;
    }
    case 'delete': {
      await supabase
        .from('test_case_revisions')
        .delete()
        .in('test_case_id', caseIds)
        .eq('project_id', project.id);
      const { error: dbError } = await supabase
        .from('test_cases')
        .delete()
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (dbError) throw error(500, dbError.message);
      affected = caseIds.length;
      break;
    }
    case 'set_priority': {
      if (!value || !['P0', 'P1', 'P2', 'P3'].includes(value)) {
        throw error(400, 'value must be P0..P3');
      }
      const { error: dbError } = await supabase
        .from('test_cases')
        .update({ priority: value, updated_at: now })
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (dbError) throw error(500, dbError.message);
      affected = caseIds.length;
      break;
    }
    case 'set_component': {
      const { error: dbError } = await supabase
        .from('test_cases')
        .update({ component: value ?? '', updated_at: now })
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (dbError) throw error(500, dbError.message);
      affected = caseIds.length;
      break;
    }
    case 'add_tag': {
      if (!value) throw error(400, 'value required for add_tag');
      const { data: cases, error: fetchErr } = await supabase
        .from('test_cases')
        .select('id, tags')
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (fetchErr) throw error(500, fetchErr.message);
      for (const c of cases ?? []) {
        const tags: string[] = c.tags ?? [];
        if (!tags.includes(value)) {
          await supabase
            .from('test_cases')
            .update({ tags: [...tags, value], updated_at: now })
            .eq('id', c.id);
        }
      }
      affected = cases?.length ?? 0;
      break;
    }
    case 'remove_tag': {
      if (!value) throw error(400, 'value required for remove_tag');
      const { data: cases, error: fetchErr } = await supabase
        .from('test_cases')
        .select('id, tags')
        .in('id', caseIds)
        .eq('project_id', project.id);
      if (fetchErr) throw error(500, fetchErr.message);
      for (const c of cases ?? []) {
        const tags: string[] = (c.tags ?? []).filter((t: string) => t !== value);
        await supabase
          .from('test_cases')
          .update({ tags, updated_at: now })
          .eq('id', c.id);
      }
      affected = cases?.length ?? 0;
      break;
    }
    default:
      throw error(400, `unknown action: ${action}`);
  }

  audit({
    actorId: user.id,
    projectId: project.id,
    action: `cases.bulk.${action}`,
    payload: { count: caseIds.length, value }
  });

  return json({ updated: affected });
};
