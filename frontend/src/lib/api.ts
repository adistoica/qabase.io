import { get } from 'svelte/store';
import { activeProjectId } from './project-store';
import { supabase } from './supabase';
import { toast } from './toast-store';

const MUTATION_TOASTS: Record<string, { label: string; type: 'created' | 'updated' | 'deleted' }> = {
  POST:   { label: 'Created', type: 'created' },
  PUT:    { label: 'Saved',   type: 'updated' },
  PATCH:  { label: 'Saved',   type: 'updated' },
  DELETE: { label: 'Deleted', type: 'deleted' },
};

export type ApiError = { status: number; detail: string };

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: { rawBody?: BodyInit; headers?: Record<string, string>; silent?: boolean; toastType?: 'created' | 'updated' | 'deleted' | 'info' } = {}
): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers || {}) };
  if (body && !options.rawBody) {
    headers['Content-Type'] = 'application/json';
  }
  const pid = get(activeProjectId);
  if (pid) headers['X-Project-Id'] = pid;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: options.rawBody ?? (body ? JSON.stringify(body) : undefined)
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail ?? j.message ?? detail;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && typeof window !== 'undefined') {
      const p = window.location.pathname;
      if (p !== '/login' && !p.startsWith('/public/') && !p.startsWith('/invite/')) {
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
    if (!options.silent && method !== 'GET') toast.error(detail);
    throw { status: res.status, detail } satisfies ApiError;
  }
  const mt = MUTATION_TOASTS[method];
  if (!options.silent && mt) {
    const type = options.toastType ?? mt.type;
    const label = options.toastType
      ? options.toastType.charAt(0).toUpperCase() + options.toastType.slice(1)
      : mt.label;
    toast[type](label);
  }
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

type MutationOpts = { silent?: boolean; toastType?: 'created' | 'updated' | 'deleted' | 'info' };

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, opts?: MutationOpts) =>
    request<T>('POST', path, body, opts ?? {}),
  put: <T>(path: string, body?: unknown, opts?: MutationOpts) =>
    request<T>('PUT', path, body, opts ?? {}),
  patch: <T>(path: string, body?: unknown, opts?: MutationOpts) =>
    request<T>('PATCH', path, body, opts ?? {}),
  del: <T>(path: string, opts?: MutationOpts) =>
    request<T>('DELETE', path, undefined, opts ?? {}),
  upload: <T>(path: string, form: FormData, opts?: MutationOpts) =>
    request<T>('POST', path, undefined, { rawBody: form, ...(opts ?? {}) })
};

// --- Types --------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
}

export interface Project {
  id: string;
  slug: string;
  name: string;
  code_prefix: string;
  description: string;
  next_code: number;
  custom_fields: CustomFieldDef[];
  integrations: IntegrationConfig;
  role_overrides: Record<string, string[]>;
}

export interface CustomFieldDef {
  key: string;
  label: string;
  type: 'string' | 'text' | 'number' | 'date' | 'enum' | 'boolean';
  options: string[];
  required: boolean;
  description: string;
}

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

export interface EmbeddedStep {
  kind: 'ref' | 'inline';
  step_id?: string;
  title?: string;
  body_md: string;
  expected_md: string;
  overrides?: Record<string, unknown>;
}

export interface TestCase {
  id: string;
  code: string;
  project_id?: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  component: string;
  tags: string[];
  description_md: string;
  preconditions_md: string;
  steps: EmbeddedStep[];
  custom_fields: Record<string, unknown>;
  requirement_ids: string[];
  current_revision: number;
  archived: boolean;
  review_status: 'draft' | 'in_review' | 'approved' | 'rejected';
  owner_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Step {
  id: string;
  title: string;
  body_md: string;
  expected_md: string;
  tags: string[];
  used_by_count: number;
  updated_at: string;
}

export interface SuiteFilter {
  tags_in: string[];
  components_in: string[];
  priorities_in: string[];
  include_archived: boolean;
  query: string;
}

export interface Suite {
  id: string;
  name: string;
  parent_id?: string | null;
  position: number;
  type: 'static' | 'dynamic';
  static_case_ids: string[];
  filter: SuiteFilter;
  description: string;
  case_count: number;
  updated_at: string;
}

export interface Milestone {
  id: string;
  name: string;
  status: 'open' | 'closed';
  description: string;
  due_at?: string | null;
  closed_at?: string | null;
  runs_total: number;
  runs_passed: number;
  pass_rate: number;
}

export interface TestPlan {
  id: string;
  name: string;
  description: string;
  milestone_id?: string | null;
  suite_ids: string[];
  extra_case_ids: string[];
  case_count: number;
  updated_at: string;
}

export interface Requirement {
  id: string;
  external_id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  case_ids: string[];
  case_count: number;
  last_status?: string | null;
  pass_rate: number;
}

export type ResultStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'pending';

export interface RunStepResult {
  position: number;
  status: ResultStatus;
  notes_md: string;
  attachment_ids: string[];
  executed_at?: string | null;
}

export interface DefectLink {
  system: string;
  external_id: string;
  url: string;
  sync_state?: string;
  last_synced_at?: string | null;
  opened_at: string;
  closed_at?: string | null;
}

export interface RunResult {
  test_case_id: string;
  revision: number;
  code: string;
  title: string;
  status: ResultStatus;
  assigned_to?: string | null;
  executed_by?: string | null;
  executed_at?: string | null;
  duration_seconds?: number | null;
  notes_md: string;
  step_results: RunStepResult[];
  defect_links: DefectLink[];
}

export interface RunSummary {
  total: number;
  passed: number;
  failed: number;
  blocked: number;
  skipped: number;
  pending: number;
  pass_rate: number;
}

export interface RunEnvironment {
  name: string;
  browser: string;
  os: string;
  build: string;
  extra: Record<string, string>;
}

export interface Run {
  id: string;
  project_id?: string;
  name: string;
  suite_id?: string | null;
  plan_id?: string | null;
  milestone_id?: string | null;
  description: string;
  environment: RunEnvironment;
  started_at: string;
  finished_at?: string | null;
  status: 'in_progress' | 'completed' | 'aborted';
  source: 'manual' | 'ci' | 'rerun';
  summary: RunSummary;
  results: RunResult[];
}

export interface DashboardOverview {
  total_cases: number;
  total_runs: number;
  active_runs: number;
  open_milestones: number;
  recent_runs: Array<{
    id: string;
    name: string;
    status: string;
    summary: RunSummary;
    started_at: string;
  }>;
  trend: Array<{ date: string; pass_rate: number; total: number }>;
}

export interface CoverageRow {
  component: string;
  count: number;
  p0: number;
  p1: number;
}

export interface FlakinessRow {
  test_case_id: string;
  title: string;
  code?: string;
  runs: number;
  passed: number;
  failed: number;
  flakiness: number;
}

export interface ReleaseScorecard {
  milestone_id: string;
  name: string;
  due_at?: string | null;
  pass_rate: number;
  passed: number;
  failed: number;
  blocked: number;
  total: number;
}

export interface Comment {
  id: string;
  target_kind: string;
  target_id: string;
  author_id: string;
  author_display_name: string;
  author_email: string;
  body_md: string;
  mentions: string[];
  created_at: string;
  edited_at?: string | null;
}

export interface ShareEntry {
  id: string;
  token: string;
  kind: string;
  target_id?: string | null;
  expires_at?: string | null;
  revoked: boolean;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  my_role: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  role: string;
  status: string;
  joined_at: string;
  user: { id: string; email: string; display_name: string };
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string;
  created_at: string;
  users?: { display_name: string; email: string } | null;
}

export interface AuditEvent {
  id: string;
  actor_id?: string | null;
  action: string;
  target_kind: string;
  target_id?: string | null;
  payload: Record<string, unknown>;
  ip: string;
  created_at: string;
}

export interface QueueItem {
  run_id: string;
  run_name: string;
  result_index: number;
  title: string;
  code: string;
  status: string;
}

export interface Review {
  id: string;
  test_case_id: string;
  case_code: string;
  case_title: string;
  status: 'pending' | 'approved' | 'rejected';
  submitted_by: string;
  reviewed_by?: string | null;
  note: string;
  submitted_at: string;
  decided_at?: string | null;
}

export interface Environment {
  id: string;
  name: string;
  description: string;
  browser: string;
  os: string;
  build: string;
  variables: Record<string, string>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ExploratoryBug {
  id: string;
  title: string;
  description_md: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  external_url: string;
  created_at: string;
}

export interface ExploratoryScreenshot {
  id: string;
  mime: string;
  size: number;
  original_name: string;
  uploaded_by?: string | null;
  uploaded_at: string;
}

export interface ExploratorySession {
  id: string;
  title: string;
  charter: string;
  notes_md: string;
  status: 'active' | 'paused' | 'completed';
  started_by?: string | null;
  started_at: string;
  active_since?: string | null;
  elapsed_seconds: number;
  discovered_bugs: ExploratoryBug[];
  screenshots: ExploratoryScreenshot[];
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RunResultRef {
  run_id: string;
  result_index: number;
}

export interface Defect {
  id: string;
  title: string;
  description_md: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  run_result_refs: RunResultRef[];
  external_links: Array<{ system: string; external_id: string; url: string; sync_state?: string }>;
  reported_by?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at: string;
}
