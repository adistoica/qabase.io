<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { currentUser } from '$lib/auth-store';
  import type { Project, ShareEntry } from '$lib/api';
  import { Trash2, Copy } from '@lucide/svelte';
  import { toast } from '$lib/toast-store';
  import { modal } from '$lib/modal-store';
  import ThemePicker from '$lib/components/ThemePicker.svelte';

  let project: Project | null = null;
  let loading = true;
  let saving = false;
  let msg = '';

  // password change
  let curPw = '', nextPw = '', confirmPw = '', pwMsg = '', pwSaving = false;

  // CI upload
  let ciFile: HTMLInputElement;
  let ciName = '';
  let ciEnv = '';
  let ciBuild = '';
  let ciResult: { run_id?: string; total?: number; passed?: number; failed?: number } = {};

  // Shares
  let shares: ShareEntry[] = [];

  async function load() {
    loading = true;
    try {
      project = await api.get<Project>('/projects/current');
      try { shares = await api.get<ShareEntry[]>('/share'); } catch { shares = []; }
    } finally { loading = false; }
  }

  async function saveProject() {
    if (!project) return;
    saving = true; msg = '';
    try {
      await api.put(`/projects/${project.id}`, {
        name: project.name,
        description: project.description,
        custom_fields: project.custom_fields,
        integrations: project.integrations,
      });
      msg = 'Saved.';
      setTimeout(() => (msg = ''), 1800);
    } catch (e: any) {
      msg = e?.detail || 'save failed';
    } finally { saving = false; }
  }

  async function changePassword() {
    pwMsg = '';
    if (nextPw !== confirmPw) { pwMsg = 'Passwords do not match'; return; }
    pwSaving = true;
    try {
      await api.post('/auth/change-password', { current_password: curPw, new_password: nextPw });
      pwMsg = 'Password updated.';
      curPw = nextPw = confirmPw = '';
    } catch (e: any) {
      pwMsg = e?.detail || 'failed';
    } finally { pwSaving = false; }
  }

  async function testSlack() {
    const r = await api.post<{ ok: boolean }>('/integrations/test/slack', undefined, { silent: true });
    if (r.ok) toast.success('Slack webhook: OK'); else toast.error('Slack test failed — check webhook URL');
  }
  async function testWebhook() {
    const r = await api.post<{ ok: boolean }>('/integrations/test/webhook', undefined, { silent: true });
    if (r.ok) toast.success('Webhook: OK'); else toast.error('Webhook test failed');
  }

  async function ingestCI() {
    const f = ciFile.files?.[0];
    if (!f || !ciName) { await modal.alert('Missing fields', 'Please select a JUnit XML file and enter a run name.'); return; }
    const form = new FormData();
    form.append('name', ciName);
    form.append('file', f);
    form.append('environment_name', ciEnv);
    form.append('build', ciBuild);
    ciResult = await api.upload('/ingest/junit', form);
  }

  async function addCustomField() {
    if (!project) return;
    project.custom_fields = [...project.custom_fields, {
      key: 'new_field', label: 'New field', type: 'string', options: [], required: false, description: ''
    }];
  }
  function removeCustomField(i: number) {
    if (!project) return;
    project.custom_fields = project.custom_fields.filter((_, j) => j !== i);
  }

  async function createShare() {
    const r = await api.post<ShareEntry>('/share', { kind: 'dashboard', target_id: null, ttl_days: 30 });
    shares = [r, ...shares];
  }
  async function revokeShare(id: string) {
    await api.post(`/share/${id}/revoke`, undefined, { toastType: 'deleted' });
    shares = shares.map((s) => (s.id === id ? { ...s, revoked: true } : s));
  }
  async function copyShareUrl(s: ShareEntry) {
    const url = s.kind === 'run' && s.target_id
      ? `${window.location.origin}/api/public/run/${s.token}`
      : `${window.location.origin}/api/public/dashboard/${s.token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Share link copied');
  }

  onMount(load);
</script>

<PageHeader title="Settings" subtitle="Profile, project, integrations, CI ingestion, share links." />

{#if loading || !project}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else}
  <div class="space-y-6">
    <!-- Appearance -->
    <div class="card p-5">
      <h2 class="font-semibold mb-4">Appearance</h2>
      <ThemePicker inline />
    </div>

    <!-- Profile + password -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-5">
        <h2 class="font-semibold mb-3">Profile</h2>
        {#if $currentUser}
          <dl class="text-sm space-y-2">
            <div class="flex justify-between"><dt class="text-[var(--color-muted-foreground)]">Email</dt><dd>{$currentUser.email}</dd></div>
            <div class="flex justify-between"><dt class="text-[var(--color-muted-foreground)]">Name</dt><dd>{$currentUser.display_name}</dd></div>
            <div class="flex justify-between"><dt class="text-[var(--color-muted-foreground)]">Roles</dt><dd>{$currentUser.roles.join(', ')}</dd></div>
          </dl>
        {/if}
      </div>
      <div class="card p-5">
        <h2 class="font-semibold mb-3">Change password</h2>
        <form on:submit|preventDefault={changePassword} class="space-y-3">
          <input type="password" class="input" placeholder="Current password" bind:value={curPw} required />
          <input type="password" class="input" placeholder="New password (≥ 8 chars)" bind:value={nextPw} minlength="8" required />
          <input type="password" class="input" placeholder="Confirm new password" bind:value={confirmPw} minlength="8" required />
          {#if pwMsg}<div class="text-xs text-[var(--color-muted-foreground)]">{pwMsg}</div>{/if}
          <button class="btn btn-primary" type="submit" disabled={pwSaving}>{pwSaving ? 'Saving…' : 'Update password'}</button>
        </form>
      </div>
    </div>

    <!-- Project -->
    <div class="card p-5">
      <h2 class="font-semibold mb-3">Project</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label class="text-xs font-medium">Name</label><input class="input mt-1" bind:value={project.name} /></div>
        <div><label class="text-xs font-medium">Slug</label><input class="input mt-1" value={project.slug} disabled /></div>
        <div><label class="text-xs font-medium">Code prefix</label><input class="input mt-1" value={project.code_prefix} disabled /></div>
      </div>
      <div class="mt-3"><label class="text-xs font-medium">Description</label><input class="input mt-1" bind:value={project.description} /></div>
    </div>

    <!-- Custom fields -->
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">Custom fields on test cases</h2>
        <button class="btn btn-outline" on:click={addCustomField}>+ Add field</button>
      </div>
      <div class="space-y-2">
        {#each project.custom_fields as cf, i}
          <div class="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
            <input class="input" bind:value={cf.key} placeholder="key" />
            <input class="input" bind:value={cf.label} placeholder="Label" />
            <select class="input" bind:value={cf.type}>
              <option value="string">string</option>
              <option value="text">text</option>
              <option value="number">number</option>
              <option value="date">date</option>
              <option value="enum">enum</option>
              <option value="boolean">boolean</option>
            </select>
            <input class="input md:col-span-2" placeholder="enum options (comma-separated)"
              value={cf.options.join(',')}
              on:change={(e) => (cf.options = (e.target as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean))}
            />
            <button class="btn btn-ghost" on:click={() => removeCustomField(i)}><Trash2 size={14} /></button>
          </div>
        {/each}
      </div>
    </div>

    <!-- Integrations -->
    <div class="card p-5">
      <h2 class="font-semibold mb-3">Integrations</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium">Slack webhook URL</label>
          <input class="input mt-1" bind:value={project.integrations.slack_webhook_url} placeholder="https://hooks.slack.com/services/..." />
          <button class="btn btn-outline mt-2" on:click={testSlack}>Send test</button>
        </div>
        <div>
          <label class="text-xs font-medium">Generic webhook URL (run.finished + test.failed)</label>
          <input class="input mt-1" bind:value={project.integrations.generic_webhook_url} />
          <button class="btn btn-outline mt-2" on:click={testWebhook}>Send test</button>
        </div>
        <div>
          <label class="text-xs font-medium">Jira base URL</label>
          <input class="input mt-1" bind:value={project.integrations.jira_base_url} placeholder="https://your-org.atlassian.net" />
        </div>
        <div>
          <label class="text-xs font-medium">Jira project key</label>
          <input class="input mt-1" bind:value={project.integrations.jira_project_key} placeholder="QA" />
        </div>
        <div>
          <label class="text-xs font-medium">Jira email</label>
          <input class="input mt-1" bind:value={project.integrations.jira_email} />
        </div>
        <div>
          <label class="text-xs font-medium">Jira API token</label>
          <input type="password" class="input mt-1" bind:value={project.integrations.jira_api_token} />
        </div>
      </div>
    </div>

    <div class="flex justify-end">
      <button class="btn btn-primary" disabled={saving} on:click={saveProject}>
        {saving ? 'Saving…' : 'Save project settings'}
      </button>
      {#if msg}<span class="text-xs text-[var(--color-muted-foreground)] ml-3 self-center">{msg}</span>{/if}
    </div>

    <!-- CI ingestion -->
    <div class="card p-5">
      <h2 class="font-semibold mb-3">CI ingestion (JUnit XML)</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input class="input" placeholder="Run name" bind:value={ciName} />
        <input class="input" placeholder="Environment" bind:value={ciEnv} />
        <input class="input" placeholder="Build #" bind:value={ciBuild} />
        <input bind:this={ciFile} type="file" accept=".xml" class="input" />
      </div>
      <button class="btn btn-primary mt-3" on:click={ingestCI}>Ingest XML</button>
      {#if ciResult.run_id}
        <p class="text-sm mt-3">
          ✅ Created <a class="underline" href={`/runs/${ciResult.run_id}`}>run {ciResult.run_id.slice(-6)}</a>
          — {ciResult.passed}/{ciResult.total} passed, {ciResult.failed} failed.
        </p>
      {/if}
    </div>

    <!-- Shares -->
    <div class="card p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-semibold">Public share links</h2>
        <button class="btn btn-outline" on:click={createShare}>+ Dashboard share</button>
      </div>
      {#if shares.length === 0}
        <div class="text-sm text-[var(--color-muted-foreground)]">No share links yet.</div>
      {:else}
        <table class="w-full text-sm">
          <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
            <tr class="text-left"><th class="py-2">Kind</th><th class="py-2">Token</th><th class="py-2">Expires</th><th class="py-2"></th></tr>
          </thead>
          <tbody>
            {#each shares as s}
              <tr class="border-t">
                <td class="py-2">{s.kind}{s.revoked ? ' · revoked' : ''}</td>
                <td class="py-2 font-mono text-xs truncate max-w-xs">{s.token.slice(0, 12)}…</td>
                <td class="py-2 text-[var(--color-muted-foreground)]">{s.expires_at || 'never'}</td>
                <td class="py-2 text-right">
                  <button class="btn btn-ghost" on:click={() => copyShareUrl(s)} title="Copy URL"><Copy size={14} /></button>
                  {#if !s.revoked}
                    <button class="btn btn-ghost" on:click={() => revokeShare(s.id)}>Revoke</button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  </div>
{/if}
