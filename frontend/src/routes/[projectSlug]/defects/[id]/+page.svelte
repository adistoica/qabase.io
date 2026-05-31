<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import type { Defect, Run } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { ArrowLeft, Plus, Trash2, Check, X, ExternalLink } from '@lucide/svelte';
  import { modal } from '$lib/modal-store';

  const defectId = $page.params.id;
  $: slug = $page.params.projectSlug;

  let defect: Defect | null = null;
  let loading = true;
  let saving = false;
  let error = '';

  let editMode = false;
  let form = { title: '', description_md: '', status: '', severity: '', assigned_to: '' };

  let linkRunId = '';
  let linkResultIndex = '';
  let linking = false;
  let linkError = '';

  let extSystem = '';
  let extId = '';
  let extUrl = '';
  let addingExt = false;

  // resolved run names for display
  let runNames: Record<string, string> = {};

  async function load() {
    loading = true;
    defect = await api.get<Defect>(`/defects/${defectId}`);
    form = {
      title: defect.title,
      description_md: defect.description_md,
      status: defect.status,
      severity: defect.severity,
      assigned_to: defect.assigned_to ?? '',
    };
    await resolveRunNames();
    loading = false;
  }

  async function resolveRunNames() {
    if (!defect) return;
    for (const ref of defect.run_result_refs) {
      if (runNames[ref.run_id]) continue;
      try {
        const run = await api.get<Run>(`/runs/${ref.run_id}`);
        runNames[ref.run_id] = run.name;
      } catch {
        runNames[ref.run_id] = ref.run_id;
      }
    }
    runNames = { ...runNames };
  }

  onMount(load);

  async function saveEdit() {
    saving = true;
    error = '';
    try {
      defect = await api.put<Defect>(`/defects/${defectId}`, {
        title: form.title.trim() || undefined,
        description_md: form.description_md,
        status: form.status,
        severity: form.severity,
        assigned_to: form.assigned_to || null,
      });
      editMode = false;
    } catch (e: any) {
      error = e?.detail ?? 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function remove() {
    if (!await modal.confirm('Delete defect', 'This defect will be permanently deleted.', { destructive: true })) return;
    await api.del(`/defects/${defectId}`);
    goto(`/${slug}/defects`);
  }

  async function linkResult() {
    if (!linkRunId.trim()) { linkError = 'Run ID required'; return; }
    linking = true;
    linkError = '';
    try {
      defect = await api.post<Defect>(`/defects/${defectId}/link`, {
        run_id: linkRunId.trim(),
        result_index: parseInt(linkResultIndex) || 0,
      });
      linkRunId = '';
      linkResultIndex = '';
      await resolveRunNames();
    } catch (e: any) {
      linkError = e?.detail ?? 'Failed';
    } finally {
      linking = false;
    }
  }

  async function unlinkResult(run_id: string, result_index: number) {
    defect = await api.del<Defect>(`/defects/${defectId}/link`, { run_id, result_index } as any);
  }

  async function addExternal() {
    if (!extSystem.trim() || !extId.trim()) { return; }
    addingExt = true;
    try {
      defect = await api.post<Defect>(`/defects/${defectId}/external`, {
        system: extSystem.trim(),
        external_id: extId.trim(),
        url: extUrl.trim(),
      });
      extSystem = '';
      extId = '';
      extUrl = '';
    } catch (e: any) {
      await modal.alert('Error', e?.detail ?? 'Failed', { destructive: true });
    } finally {
      addingExt = false;
    }
  }

  async function removeExternal(external_id: string) {
    defect = await api.del<Defect>(`/defects/${defectId}/external/${encodeURIComponent(external_id)}`);
  }

  function severityBadge(s: string) {
    if (s === 'critical') return 'badge badge-destructive';
    if (s === 'high') return 'badge badge-warning';
    if (s === 'medium') return 'badge badge-info';
    return 'badge';
  }

  function statusBadge(s: string) {
    if (s === 'resolved' || s === 'closed') return 'badge badge-success';
    if (s === 'in_progress') return 'badge badge-info';
    return 'badge badge-destructive';
  }
</script>

<PageHeader title={defect?.title ?? 'Defect'}>
  <svelte:fragment slot="actions">
    <a href={`/${slug}/defects`} class="btn btn-ghost"><ArrowLeft size={15} /> Back</a>
    {#if !editMode}
      <button class="btn btn-ghost" on:click={() => (editMode = true)}>Edit</button>
    {/if}
    <button class="btn btn-ghost text-[var(--color-destructive)]" on:click={remove}>Delete</button>
  </svelte:fragment>
</PageHeader>

<div class="p-4">
  {#if loading}
    <p class="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
  {:else if defect}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Main -->
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-4 space-y-3">
          {#if editMode}
            {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
            <div>
              <label class="label">Title</label>
              <input class="input w-full" bind:value={form.title} />
            </div>
            <div>
              <label class="label">Description</label>
              <textarea class="input w-full h-32 resize-y font-mono text-xs" bind:value={form.description_md}></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label">Status</label>
                <select class="input w-full" bind:value={form.status}>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label class="label">Severity</label>
                <select class="input w-full" bind:value={form.severity}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary" on:click={saveEdit} disabled={saving}>
                <Check size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button class="btn btn-ghost" on:click={() => (editMode = false)}><X size={14} /> Cancel</button>
            </div>
          {:else}
            <div class="flex items-center gap-2 flex-wrap">
              <span class={severityBadge(defect.severity)}>{defect.severity}</span>
              <span class={statusBadge(defect.status)}>{defect.status.replace('_', ' ')}</span>
              <span class="text-xs text-[var(--color-muted-foreground)]">Created {formatDate(defect.created_at)}</span>
            </div>
            {#if defect.description_md}
              <p class="text-sm whitespace-pre-wrap">{defect.description_md}</p>
            {:else}
              <p class="text-sm text-[var(--color-muted-foreground)] italic">No description.</p>
            {/if}
          {/if}
        </div>

        <!-- Linked run results -->
        <div class="card p-4 space-y-3">
          <h3 class="font-semibold text-sm">Linked run results</h3>
          {#if defect.run_result_refs.length === 0}
            <p class="text-xs text-[var(--color-muted-foreground)]">No linked runs yet.</p>
          {:else}
            <ul class="space-y-1">
              {#each defect.run_result_refs as ref}
                <li class="flex items-center justify-between text-sm">
                  <a href={`/${slug}/runs/${ref.run_id}`} class="text-[var(--color-info)] hover:underline text-xs">
                    {runNames[ref.run_id] ?? ref.run_id} · result #{ref.result_index}
                  </a>
                  <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" on:click={() => unlinkResult(ref.run_id, ref.result_index)}>
                    <Trash2 size={12} />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="border-t pt-2 space-y-2">
            <p class="text-xs font-medium text-[var(--color-muted-foreground)]">Link a run result</p>
            {#if linkError}<p class="text-xs text-[var(--color-destructive)]">{linkError}</p>{/if}
            <div class="flex gap-2">
              <input class="input flex-1" placeholder="Run ID" bind:value={linkRunId} />
              <input class="input w-24" placeholder="Result #" type="number" min="0" bind:value={linkResultIndex} />
              <button class="btn btn-ghost btn-sm" on:click={linkResult} disabled={linking}>
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-4">
        <!-- External links -->
        <div class="card p-4 space-y-3">
          <h3 class="font-semibold text-sm">External links</h3>
          {#if defect.external_links.length === 0}
            <p class="text-xs text-[var(--color-muted-foreground)]">No external links.</p>
          {:else}
            <ul class="space-y-1.5">
              {#each defect.external_links as lnk}
                <li class="flex items-center justify-between text-xs">
                  <div class="min-w-0">
                    <span class="badge mr-1">{lnk.system}</span>
                    {#if lnk.url}
                      <a href={lnk.url} target="_blank" class="text-[var(--color-info)] hover:underline inline-flex items-center gap-0.5">
                        {lnk.external_id} <ExternalLink size={10} />
                      </a>
                    {:else}
                      <span>{lnk.external_id}</span>
                    {/if}
                    {#if lnk.sync_state}
                      <span class="ml-1 text-[var(--color-muted-foreground)]">({lnk.sync_state})</span>
                    {/if}
                  </div>
                  <button class="btn btn-ghost btn-sm px-1 text-[var(--color-destructive)]" on:click={() => removeExternal(lnk.external_id)}>
                    <X size={11} />
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="border-t pt-2 space-y-1.5">
            <p class="text-xs font-medium text-[var(--color-muted-foreground)]">Add external link</p>
            <input class="input w-full" placeholder="System (jira, github…)" bind:value={extSystem} />
            <input class="input w-full" placeholder="Issue ID" bind:value={extId} />
            <input class="input w-full" placeholder="URL (optional)" bind:value={extUrl} />
            <button class="btn btn-ghost btn-sm w-full" on:click={addExternal} disabled={addingExt || !extSystem || !extId}>
              <Plus size={13} /> {addingExt ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>

        <div class="card p-4 space-y-1 text-xs text-[var(--color-muted-foreground)]">
          <div>Created: {formatDate(defect.created_at)}</div>
          <div>Updated: {formatDate(defect.updated_at)}</div>
          {#if defect.reported_by}<div>Reporter: {defect.reported_by}</div>{/if}
          {#if defect.assigned_to}<div>Assigned: {defect.assigned_to}</div>{/if}
        </div>
      </div>
    </div>
  {/if}
</div>
