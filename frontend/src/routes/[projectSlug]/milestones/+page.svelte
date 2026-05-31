<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Milestone } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate, formatPct, statusBadgeClass } from '$lib/format';
  import { Plus, Flag } from '@lucide/svelte';

  let ms: Milestone[] = [];
  let loading = true;

  let showForm = false;
  let name = '';
  let description = '';
  let dueAt = '';
  let creating = false;

  async function load() {
    loading = true;
    ms = await api.get<Milestone[]>('/milestones');
    loading = false;
  }

  async function create() {
    if (!name) return;
    creating = true;
    try {
      const created = await api.post<Milestone>('/milestones', {
        name,
        description,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: 'open',
      });
      ms = [created, ...ms];
      name = description = dueAt = '';
      showForm = false;
    } finally {
      creating = false;
    }
  }

  async function toggleStatus(m: Milestone) {
    const updated = await api.put<Milestone>(`/milestones/${m.id}`, {
      name: m.name,
      description: m.description,
      due_at: m.due_at,
      status: m.status === 'open' ? 'closed' : 'open',
    });
    ms = ms.map((x) => x.id === updated.id ? updated : x);
  }

  onMount(load);
</script>

<PageHeader title="Milestones" subtitle="Anchor cases and runs to a release or sprint.">
  <button slot="actions" class="btn btn-primary" on:click={() => (showForm = !showForm)}>
    <Plus size={16} /> {showForm ? 'Cancel' : 'New milestone'}
  </button>
</PageHeader>

{#if showForm}
  <div class="card p-5 mb-6 grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
    <div class="space-y-1.5 md:col-span-1">
      <label class="text-xs font-medium">Name</label>
      <input class="input" bind:value={name} placeholder="Release 2.5" />
    </div>
    <div class="space-y-1.5 md:col-span-1">
      <label class="text-xs font-medium">Due date</label>
      <input type="date" class="input" bind:value={dueAt} />
    </div>
    <div class="space-y-1.5 md:col-span-1">
      <label class="text-xs font-medium">Description</label>
      <input class="input" bind:value={description} />
    </div>
    <div class="md:col-span-3 flex justify-end">
      <button class="btn btn-primary" disabled={!name || creating} on:click={create}>
        {creating ? 'Creating…' : 'Create'}
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
    {#each Array(3) as _}
      <div class="card p-5 space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1.5 flex-1">
            <div class="h-4 w-2/3 rounded bg-[var(--color-muted)]"></div>
            <div class="h-3 w-1/3 rounded bg-[var(--color-muted)]"></div>
          </div>
          <div class="h-5 w-14 rounded-full bg-[var(--color-muted)]"></div>
        </div>
        <div class="flex gap-4 mt-2">
          <div class="space-y-1">
            <div class="h-2.5 w-12 rounded bg-[var(--color-muted)]"></div>
            <div class="h-4 w-8 rounded bg-[var(--color-muted)]"></div>
          </div>
          <div class="space-y-1">
            <div class="h-2.5 w-8 rounded bg-[var(--color-muted)]"></div>
            <div class="h-4 w-6 rounded bg-[var(--color-muted)]"></div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{:else if ms.length === 0}
  <div class="card p-12 text-center">
    <Flag size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)] mb-3">No milestones yet.</div>
    <button class="btn btn-primary" on:click={() => (showForm = true)}>
      <Plus size={16} /> Create your first milestone
    </button>
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {#each ms as m}
      <div class="card p-5">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="font-semibold">{m.name}</div>
            <div class="text-xs text-[var(--color-muted-foreground)] mt-0.5">
              {m.due_at ? `Due ${formatDate(m.due_at)}` : 'No due date'}
            </div>
          </div>
          <button
            class={statusBadgeClass(m.status)}
            on:click={() => toggleStatus(m)}
            title="Toggle status"
          >
            {m.status}
          </button>
        </div>
        {#if m.description}
          <p class="text-sm text-[var(--color-muted-foreground)] mt-2">{m.description}</p>
        {/if}
        <div class="mt-4 flex items-center gap-3 text-sm">
          <div>
            <div class="text-[var(--color-muted-foreground)] text-xs">Pass rate</div>
            <div class="font-semibold">{formatPct(m.pass_rate)}</div>
          </div>
          <div>
            <div class="text-[var(--color-muted-foreground)] text-xs">Runs</div>
            <div class="font-semibold">{m.runs_total}</div>
          </div>
        </div>
      </div>
    {/each}
  </div>
{/if}
