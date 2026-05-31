<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import type { Defect } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { Plus, Bug, Check, X } from '@lucide/svelte';
  import { page } from '$app/stores';

  $: slug = $page.params.projectSlug;

  let defects: Defect[] = [];
  let loading = true;
  let filterStatus = '';
  let filterSeverity = '';

  let showCreate = false;
  let form = { title: '', description_md: '', severity: 'medium' };
  let saving = false;
  let error = '';

  async function load() {
    loading = true;
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterSeverity) params.set('severity', filterSeverity);
    const qs = params.toString() ? `?${params}` : '';
    defects = await api.get<Defect[]>(`/defects${qs}`);
    loading = false;
  }

  onMount(load);

  async function create() {
    if (!form.title.trim()) { error = 'Title is required'; return; }
    saving = true;
    error = '';
    try {
      await api.post<Defect>('/defects', { ...form, title: form.title.trim() });
      showCreate = false;
      form = { title: '', description_md: '', severity: 'medium' };
      await load();
    } catch (e: any) {
      error = e?.detail ?? 'Failed';
    } finally {
      saving = false;
    }
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

<PageHeader title="Defects">
  <svelte:fragment slot="actions">
    <button class="btn btn-primary" on:click={() => (showCreate = !showCreate)}>
      <Plus size={16} /> New defect
    </button>
  </svelte:fragment>
</PageHeader>

<div class="space-y-4">
  <!-- Filters -->
  <div class="flex gap-2 flex-wrap">
    <select class="input w-auto" bind:value={filterStatus} on:change={load}>
      <option value="">All statuses</option>
      <option value="open">Open</option>
      <option value="in_progress">In progress</option>
      <option value="resolved">Resolved</option>
      <option value="closed">Closed</option>
    </select>
    <select class="input w-auto" bind:value={filterSeverity} on:change={load}>
      <option value="">All severities</option>
      <option value="critical">Critical</option>
      <option value="high">High</option>
      <option value="medium">Medium</option>
      <option value="low">Low</option>
    </select>
  </div>

  <!-- Create form -->
  {#if showCreate}
    <div class="card p-4 space-y-3 border-2 border-[var(--color-accent)]">
      <div class="font-medium text-sm">New defect</div>
      {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
      <input class="input w-full" placeholder="Title *" bind:value={form.title} />
      <textarea class="input w-full h-20 resize-y" placeholder="Description (optional markdown)" bind:value={form.description_md}></textarea>
      <div>
        <label class="label">Severity</label>
        <select class="input w-auto" bind:value={form.severity}>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" on:click={create} disabled={saving}>
          <Check size={14} /> {saving ? 'Creating…' : 'Create'}
        </button>
        <button class="btn btn-ghost" on:click={() => (showCreate = false)}><X size={14} /> Cancel</button>
      </div>
    </div>
  {/if}

  <!-- Table -->
  {#if loading}
    <div class="card overflow-hidden animate-pulse">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">
            <th class="text-left px-4 py-2 font-medium">Title</th>
            <th class="text-left px-4 py-2 font-medium">Severity</th>
            <th class="text-left px-4 py-2 font-medium">Status</th>
            <th class="text-left px-4 py-2 font-medium">Linked runs</th>
            <th class="text-left px-4 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {#each Array(5) as _}
            <tr class="border-b last:border-0">
              <td class="px-4 py-2.5"><div class="h-3 w-48 rounded bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-2.5"><div class="h-5 w-16 rounded-full bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-2.5"><div class="h-5 w-20 rounded-full bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-2.5"><div class="h-3 w-4 rounded bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-2.5"><div class="h-3 w-28 rounded bg-[var(--color-muted)]"></div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if defects.length === 0}
    <div class="card p-8 text-center text-[var(--color-muted-foreground)]">
      <Bug size={32} class="mx-auto mb-2 opacity-30" />
      <p class="text-sm">No defects found.</p>
    </div>
  {:else}
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">
            <th class="text-left px-4 py-2 font-medium">Title</th>
            <th class="text-left px-4 py-2 font-medium">Severity</th>
            <th class="text-left px-4 py-2 font-medium">Status</th>
            <th class="text-left px-4 py-2 font-medium">Linked runs</th>
            <th class="text-left px-4 py-2 font-medium">Created</th>
          </tr>
        </thead>
        <tbody>
          {#each defects as d (d.id)}
            <tr
              class="border-b last:border-0 hover:bg-[var(--color-muted)]/40 cursor-pointer"
              on:click={() => goto(`/${slug}/defects/${d.id}`)}
            >
              <td class="px-4 py-2.5 font-medium">{d.title}</td>
              <td class="px-4 py-2.5"><span class={severityBadge(d.severity)}>{d.severity}</span></td>
              <td class="px-4 py-2.5"><span class={statusBadge(d.status)}>{d.status.replace('_', ' ')}</span></td>
              <td class="px-4 py-2.5 text-[var(--color-muted-foreground)]">{d.run_result_refs.length}</td>
              <td class="px-4 py-2.5 text-xs text-[var(--color-muted-foreground)]">{formatDate(d.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
