import type { SupabaseClient } from '@supabase/supabase-js';
import { error, getProjectHeaders } from './helpers';

export interface IntegrationConfig {
  slack_webhook_url: string;
  jira_base_url: string;
  jira_project_key: string;
  jira_api_token: string;
  jira_email: string;
  github_repo: string;
  github_token: string;
  generic_webhook_url: string;
}

export interface AIConfig {
  enabled: boolean;
  provider: string;
  model: string;
  api_key: string;
}

export interface AppProject {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  description: string;
  next_code: number;
  custom_fields: unknown[];
  integrations: IntegrationConfig;
  ai: AIConfig | null;
  role_overrides: Record<string, string[]>;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROJECT_SLUG = 'default';

async function ensureDefaultProject(supabase: SupabaseClient): Promise<AppProject> {
  const { data } = await supabase
    .from('projects')
    .select('*')
    .eq('slug', DEFAULT_PROJECT_SLUG)
    .single();
  if (data) return data as AppProject;

  const { data: created, error: insertError } = await supabase
    .from('projects')
    .insert({
      slug: DEFAULT_PROJECT_SLUG,
      name: 'Default',
      code_prefix: 'TP',
      description: 'Default project.'
    })
    .select()
    .single();

  if (insertError || !created) throw error(500, 'failed to create default project');
  return created as AppProject;
}

export async function getActiveProject(
  request: Request,
  supabase: SupabaseClient
): Promise<AppProject> {
  const { projectId, projectSlug } = getProjectHeaders(request);

  if (projectId) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
    if (!data) throw error(404, 'project not found');
    return data as AppProject;
  }

  if (projectSlug) {
    const { data } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', projectSlug)
      .single();
    if (!data) throw error(404, 'project not found');
    return data as AppProject;
  }

  return ensureDefaultProject(supabase);
}

export async function nextCaseCode(
  projectId: string,
  supabase: SupabaseClient
): Promise<string> {
  const { data: project, error: fetchError } = await supabase
    .from('projects')
    .select('code_prefix, next_code')
    .eq('id', projectId)
    .single();

  if (fetchError || !project) error(500, 'failed to allocate case code');

  const seq = project.next_code ?? 1;
  const code = `${project.code_prefix}-${seq}`;

  await supabase
    .from('projects')
    .update({ next_code: seq + 1 })
    .eq('id', projectId);

  return code;
}
