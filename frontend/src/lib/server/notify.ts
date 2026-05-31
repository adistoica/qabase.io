import type { AppProject, IntegrationConfig } from './projects';

const BLOCKED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '0.0.0.0',
  'metadata.google.internal'
]);

function validateOutboundUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('invalid webhook URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('webhook URL must use HTTPS');
  }
  const host = parsed.hostname.toLowerCase();
  if (!host) throw new Error('webhook URL has no host');
  if (BLOCKED_HOSTS.has(host)) {
    throw new Error(`webhook URL targets a blocked host: ${host}`);
  }
}

async function post(
  url: string,
  payload: Record<string, unknown>,
  headers?: Record<string, string>
): Promise<boolean> {
  if (!url) return false;
  try {
    validateOutboundUrl(url);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

function cfg(project: AppProject): IntegrationConfig {
  return (project.integrations ?? {}) as IntegrationConfig;
}

export async function slackMessage(project: AppProject, text: string): Promise<boolean> {
  const url = cfg(project).slack_webhook_url;
  if (!url) return false;
  return post(url, { text });
}

export async function genericWebhook(
  project: AppProject,
  event: string,
  payload: Record<string, unknown>
): Promise<boolean> {
  const url = cfg(project).generic_webhook_url;
  if (!url) return false;
  return post(url, { event, ...payload });
}

export async function fanOut(
  project: AppProject,
  event: string,
  summary: string,
  payload: Record<string, unknown>
): Promise<void> {
  const promises: Promise<boolean>[] = [];
  if (cfg(project).slack_webhook_url) promises.push(slackMessage(project, summary));
  if (cfg(project).generic_webhook_url)
    promises.push(genericWebhook(project, event, payload));
  await Promise.allSettled(promises);
}

export async function jiraCreateIssue(
  project: AppProject,
  summary: string,
  description: string,
  issueType = 'Bug'
): Promise<Record<string, unknown> | null> {
  const c = cfg(project);
  if (!c.jira_base_url || !c.jira_project_key || !c.jira_api_token || !c.jira_email) {
    return null;
  }
  const url = c.jira_base_url.replace(/\/$/, '') + '/rest/api/3/issue';
  const credentials = btoa(`${c.jira_email}:${c.jira_api_token}`);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`
      },
      body: JSON.stringify({
        fields: {
          project: { key: c.jira_project_key },
          summary,
          issuetype: { name: issueType },
          description: {
            type: 'doc',
            version: 1,
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: description }] }
            ]
          }
        }
      }),
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
