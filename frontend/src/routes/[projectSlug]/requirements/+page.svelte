<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Requirement, TestCase } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Plus, Link2, ExternalLink } from '@lucide/svelte';
  import { formatPct, statusBadgeClass } from '$lib/format';

  let reqs: Requirement[] = [];
  let cases: TestCase[] = [];
  let loading = true;

  let showForm = false;
  let external = '';
  let title = '';
  let url = '';
  let description = '';
  let chosenCases: Record<string, boolean> = {};
  let creating = false;

  async function load() {
    loading = true;
    [reqs, cases] = await Promise.all([
      api.get<Requirement[]>('/requirements'),
      api.get<TestCase[]>('/cases?limit=500'),
    ]);
    loading = false;
  }

  async function create() {
    if (!title) return;
    creating = true;
    try {
      const created = await api.post<Requirement>('/requirements', {
        external_id: external,
        title,
        description,
        url,
        source: external ? 'jira' : 'manual',
        case_ids: Object.entries(chosenCases).filter(([_, v]) => v).map(([k]) => k),
      });
      reqs = [...reqs, created];
      external = title = url = description = '';
      chosenCases = {};
      showForm = false;
    } finally {
      creating = false;
    }
  }

  onMount(load);
</script>

<PageHeader title="Requirements" subtitle="Coverage matrix — what specs have tests, and how those tests last fared.">
  <button slot="actions" class="btn btn-primary" on:click={() => (showForm = !showForm)}>
    <Plus size={16} /> {showForm ? 'Cancel' : 'New requirement'}
  </button>
</PageHeader>

{#if showForm}
  <div class="card p-5 mb-6 space-y-3">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="space-y-1.5"><label class="text-xs font-medium">External ID</label>
        <input class="input" bind:value={external} placeholder="JIRA-1234" />
      </div>
      <div class="space-y-1.5 md:col-span-2"><label class="text-xs font-medium">Title</label>
        <input class="input" bind:value={title} />
      </div>
    </div>
    <div class="space-y-1.5"><label class="text-xs font-medium">URL</label>
      <input class="input" bind:value={url} placeholder="https://…" />
    </div>
    <div class="space-y-1.5"><label class="text-xs font-medium">Description</label>
      <textarea class="textarea" rows="3" bind:value={description} />
    </div>
    <div class="space-y-1.5">
      <label class="text-xs font-medium">Link to cases</label>
      <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
        {#each cases as c}
          <label class="flex items-center gap-2 px-2 py-1 border rounded-md text-sm">
            <input type="checkbox" bind:checked={chosenCases[c.id]} />
            <span class="text-xs text-[var(--color-muted-foreground)]">{c.code}</span>
            {c.title}
          </label>
        {/each}
      </div>
    </div>
    <div class="flex justify-end">
      <button class="btn btn-primary" disabled={!title || creating} on:click={create}>
        {creating ? 'Creating…' : 'Create requirement'}
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if reqs.length === 0}
  <div class="card p-12 text-center">
    <Link2 size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)]">No requirements yet.</div>
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
    <table class="w-full text-sm">
      <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
        <tr class="text-left">
          <th class="px-4 py-2">External</th>
          <th class="px-4 py-2">Title</th>
          <th class="px-4 py-2 text-right">Cases</th>
          <th class="px-4 py-2 text-right">Coverage</th>
          <th class="px-4 py-2">Last status</th>
        </tr>
      </thead>
      <tbody>
        {#each reqs as r}
          <tr class="border-t table-row-hover">
            <td class="px-4 py-3 font-mono text-xs">
              {#if r.url}
                <a href={r.url} target="_blank" rel="noopener" class="inline-flex items-center gap-1 hover:underline">
                  {r.external_id || '—'} <ExternalLink size={12} />
                </a>
              {:else}
                {r.external_id || '—'}
              {/if}
            </td>
            <td class="px-4 py-3">{r.title}</td>
            <td class="px-4 py-3 text-right tabular-nums">{r.case_count}</td>
            <td class="px-4 py-3 text-right tabular-nums">{formatPct(r.pass_rate)}</td>
            <td class="px-4 py-3">
              {#if r.last_status}
                <span class={statusBadgeClass(r.last_status)}>{r.last_status}</span>
              {:else}
                <span class="text-[var(--color-muted-foreground)]">—</span>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </div>
{/if}
