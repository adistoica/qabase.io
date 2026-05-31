import type { SupabaseClient } from '@supabase/supabase-js';

export interface SuiteFilter {
  tags_in?: string[];
  components_in?: string[];
  priorities_in?: string[];
  include_archived?: boolean;
  query?: string;
}

export async function resolveSuiteCases(
  suite: Record<string, unknown>,
  supabase: SupabaseClient
): Promise<Record<string, unknown>[]> {
  const projectId = suite.project_id as string;

  if (suite.type === 'static') {
    const ids = (suite.static_case_ids as string[]) ?? [];
    if (!ids.length) return [];
    const { data } = await supabase
      .from('test_cases')
      .select('*')
      .eq('project_id', projectId)
      .in('id', ids);
    return data ?? [];
  }

  const f = (suite.filter ?? {}) as SuiteFilter;
  let query = supabase.from('test_cases').select('*').eq('project_id', projectId);
  if (!f.include_archived) query = query.eq('archived', false);
  if (f.tags_in?.length) query = query.overlaps('tags', f.tags_in);
  if (f.components_in?.length) query = query.in('component', f.components_in);
  if (f.priorities_in?.length) query = query.in('priority', f.priorities_in);
  const { data } = await query;
  return data ?? [];
}

export async function nextSuitePosition(
  projectId: string,
  parentId: string | null,
  supabase: SupabaseClient
): Promise<number> {
  let query = supabase
    .from('suites')
    .select('position')
    .eq('project_id', projectId)
    .order('position', { ascending: false })
    .limit(1);

  if (parentId) {
    query = query.eq('parent_id', parentId);
  } else {
    query = query.is('parent_id', null);
  }

  const { data } = await query;
  const last = data?.[0]?.position ?? 0;
  return last + 10;
}
