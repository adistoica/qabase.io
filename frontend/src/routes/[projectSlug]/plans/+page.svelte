<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Milestone, Suite, TestPlan } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Plus, Calendar, PlayCircle } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { modal } from '$lib/modal-store';

  $: slug = $page.params.projectSlug;

  let plans: TestPlan[] = [];
  let suites: Suite[] = [];
  let milestones: Milestone[] = [];
  let loading = true;

  let showForm = false;
  let name = '';
  let description = '';
  let milestoneId = '';
  let chosenSuites: Record<string, boolean> = {};
  let creating = false;

  async function load() {
    loading = true;
    [plans, suites, milestones] = await Promise.all([
      api.get<TestPlan[]>('/plans'),
      api.get<Suite[]>('/suites'),
      api.get<Milestone[]>('/milestones'),
    ]);
    loading = false;
  }

  async function create() {
    if (!name) return;
    creating = true;
    try {
      const suite_ids = Object.entries(chosenSuites).filter(([_, v]) => v).map(([k]) => k);
      await api.post('/plans', {
        name,
        description,
        milestone_id: milestoneId || null,
        suite_ids,
        extra_case_ids: [],
      });
      name = description = milestoneId = '';
      chosenSuites = {};
      showForm = false;
      await load();
    } finally {
      creating = false;
    }
  }

  async function startRun(p: TestPlan) {
    const runName = await modal.prompt('Start run', { defaultValue: `${p.name} — ${new Date().toISOString().slice(0, 10)}`, placeholder: 'Run name', confirmLabel: 'Start' });
    if (!runName) return;
    const run = await api.post<{ id: string }>('/runs', { name: runName, plan_id: p.id });
    await goto(`/${slug}/runs/${run.id}`);
  }

  onMount(load);
</script>

<PageHeader title="Test plans" subtitle="Curated suites + cases pinned to a milestone.">
  <button slot="actions" class="btn btn-primary" on:click={() => (showForm = !showForm)}>
    <Plus size={16} /> {showForm ? 'Cancel' : 'New plan'}
  </button>
</PageHeader>

{#if showForm}
  <div class="card p-5 mb-6 space-y-3">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Name</label>
        <input class="input" bind:value={name} placeholder="Release 2.5 — regression" />
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Milestone</label>
        <select class="input" bind:value={milestoneId}>
          <option value="">(none)</option>
          {#each milestones as m}
            <option value={m.id}>{m.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="space-y-1.5">
      <label class="text-xs font-medium">Description</label>
      <input class="input" bind:value={description} />
    </div>
    <div class="space-y-1.5">
      <label class="text-xs font-medium">Include suites</label>
      <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
        {#each suites as s}
          <label class="flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm cursor-pointer">
            <input type="checkbox" bind:checked={chosenSuites[s.id]} />
            {s.name}
            <span class="text-xs text-[var(--color-muted-foreground)]">({s.case_count})</span>
          </label>
        {/each}
      </div>
    </div>
    <div class="flex justify-end">
      <button class="btn btn-primary" disabled={!name || creating} on:click={create}>
        {creating ? 'Creating…' : 'Create plan'}
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
    {#each Array(3) as _}
      <div class="card p-5 space-y-3">
        <div class="h-4 w-3/4 rounded bg-[var(--color-muted)]"></div>
        <div class="h-3 w-full rounded bg-[var(--color-muted)]"></div>
        <div class="h-3 w-1/2 rounded bg-[var(--color-muted)]"></div>
        <div class="h-9 w-full rounded bg-[var(--color-muted)] mt-2"></div>
      </div>
    {/each}
  </div>
{:else if plans.length === 0}
  <div class="card p-12 text-center">
    <Calendar size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)]">No plans yet.</div>
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each plans as p}
      <div class="card p-5">
        <div class="font-semibold">{p.name}</div>
        <div class="text-sm text-[var(--color-muted-foreground)] mt-1 min-h-[2.5em]">
          {p.description || '—'}
        </div>
        <div class="text-xs text-[var(--color-muted-foreground)] mt-3">
          {p.case_count} case{p.case_count === 1 ? '' : 's'} · {p.suite_ids.length} suite{p.suite_ids.length === 1 ? '' : 's'}
        </div>
        <button class="btn btn-primary w-full mt-4" on:click={() => startRun(p)}>
          <PlayCircle size={14} /> Start run
        </button>
      </div>
    {/each}
  </div>
{/if}
