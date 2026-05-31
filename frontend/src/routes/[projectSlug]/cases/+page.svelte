<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { TestCase } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate, priorityClass } from '$lib/format';
  import { Plus, Search, Upload, Download, FileText, Tag, Trash2, Archive, RotateCcw, BookCheck, X, Check } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { modal } from '$lib/modal-store';
  import { toast } from '$lib/toast-store';

  $: slug = $page.params.projectSlug;

  let cases: TestCase[] = [];
  let query = '';
  let priorityFilter: string[] = [];
  let componentFilter = '';
  let loading = true;
  let fileInput: HTMLInputElement;
  let searchTimeout: ReturnType<typeof setTimeout>;

  let selected: Record<string, boolean> = {};
  let bulkBusy = false;

  let showCreate = false;
  let createForm = { title: '', priority: 'P2', component: '' };
  let creating = false;

  $: selectedIds = Object.entries(selected).filter(([_, v]) => v).map(([k]) => k);
  $: allSelected = cases.length > 0 && cases.every((c) => selected[c.id]);
  $: hasFilters = priorityFilter.length > 0 || componentFilter.trim().length > 0;

  async function load() {
    loading = true;
    selected = {};
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    for (const priority of priorityFilter) {
      params.append('priority', priority);
    }
    if (componentFilter.trim()) params.set('component', componentFilter.trim());
    const qs = params.toString() ? `?${params}` : '';
    cases = await api.get<TestCase[]>(`/cases${qs}`);
    loading = false;
  }

  function onQueryInput() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(load, 300);
  }

  function togglePriority(p: string) {
    if (priorityFilter.includes(p)) {
      priorityFilter = priorityFilter.filter((x) => x !== p);
    } else {
      priorityFilter = [...priorityFilter, p];
    }
    load();
  }

  function clearFilters() {
    query = '';
    priorityFilter = [];
    componentFilter = '';
    load();
  }

  async function createNew() {
    if (!createForm.title.trim()) return;
    creating = true;
    try {
      const created = await api.post<TestCase>('/cases', {
        title: createForm.title.trim(),
        priority: createForm.priority,
        component: createForm.component.trim(),
        tags: [], description_md: '', steps: [], change_note: 'created',
      });
      cases = [...cases, created];
      createForm = { title: '', priority: 'P2', component: '' };
      showCreate = false;
    } finally {
      creating = false;
    }
  }

  async function onImport(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const form = new FormData();
    form.append('file', f);
    const path = f.name.endsWith('.json') ? '/imports/cases/json' : '/imports/cases/csv';
    const r = await api.upload<{ created: number; errors: string[] }>(path, form, { silent: true });
    toast.success(`Imported ${r.created} case(s)${r.errors.length ? ` — ${r.errors.length} error(s)` : ''}`);
    await load();
  }

  function exportCsv() { window.open('/api/exports/cases.csv', '_blank'); }
  function exportJson() { window.open('/api/exports/cases.json', '_blank'); }

  function toggleAll() {
    const target = !allSelected;
    const next: Record<string, boolean> = {};
    for (const c of cases) next[c.id] = target;
    selected = next;
  }

  async function bulk(action: string, value?: string) {
    if (!selectedIds.length) return;
    if (action === 'delete' && !await modal.confirm('Delete cases', `Permanently delete ${selectedIds.length} case(s)? This cannot be undone.`, { destructive: true })) return;
    bulkBusy = true;
    const ids = new Set(selectedIds);
    try {
      const toastType = action === 'delete' ? 'deleted' : 'updated';
      await api.post<{ updated: number }>('/cases/bulk', { case_ids: selectedIds, action, value }, { toastType });
      if (action === 'delete' || action === 'archive' || action === 'restore') {
        cases = cases.filter((c) => !ids.has(c.id));
      } else if (action === 'set_priority' && value) {
        const now = new Date().toISOString();
        cases = cases.map((c) => ids.has(c.id) ? { ...c, priority: value as TestCase['priority'], updated_at: now } : c);
      } else if (action === 'set_component') {
        const now = new Date().toISOString();
        cases = cases.map((c) => ids.has(c.id) ? { ...c, component: value ?? '', updated_at: now } : c);
      } else if (action === 'add_tag' && value) {
        const now = new Date().toISOString();
        cases = cases.map((c) => ids.has(c.id) && !c.tags.includes(value) ? { ...c, tags: [...c.tags, value], updated_at: now } : c);
      } else if (action === 'remove_tag' && value) {
        const now = new Date().toISOString();
        cases = cases.map((c) => ids.has(c.id) ? { ...c, tags: c.tags.filter((t) => t !== value), updated_at: now } : c);
      }
      selected = {};
    } catch {
      // error toast shown automatically
    } finally {
      bulkBusy = false;
    }
  }

  async function bulkAddTag() {
    const v = await modal.prompt('Add tag', { placeholder: 'Tag name', confirmLabel: 'Add' });
    if (v) await bulk('add_tag', v.trim());
  }
  async function bulkRemoveTag() {
    const v = await modal.prompt('Remove tag', { placeholder: 'Tag name', confirmLabel: 'Remove' });
    if (v) await bulk('remove_tag', v.trim());
  }
  async function bulkSetPriority(p: string) {
    await bulk('set_priority', p);
  }
  async function bulkSetComponent() {
    const v = await modal.prompt('Set component', { placeholder: 'Component name (empty to clear)', confirmLabel: 'Apply' });
    if (v !== null) await bulk('set_component', v.trim());
  }

  async function bulkSubmitReview() {
    if (!selectedIds.length) return;
    bulkBusy = true;
    let submitted = 0;
    const errors: string[] = [];
    const submittedIds = new Set<string>();
    for (const id of selectedIds) {
      try {
        await api.post('/reviews', { test_case_id: id }, { silent: true });
        submitted++;
        submittedIds.add(id);
      } catch (e: any) {
        errors.push(e?.detail ?? id);
      }
    }
    cases = cases.map((c) => submittedIds.has(c.id) ? { ...c, review_status: 'in_review' } : c);
    selected = {};
    bulkBusy = false;
    toast.success(`Submitted ${submitted} case(s) for review.${errors.length ? ` Skipped: ${errors.join(', ')}` : ''}`);
  }

  function reviewBadge(s: string) {
    if (s === 'approved') return 'badge badge-success';
    if (s === 'rejected') return 'badge badge-destructive';
    if (s === 'in_review') return 'badge badge-info';
    return '';
  }

  onMount(load);
</script>

<PageHeader title="Test cases" subtitle="The full library, searchable and filterable.">
  <svelte:fragment slot="actions">
    <input bind:this={fileInput} type="file" accept=".csv,.json" class="hidden" on:change={onImport} />
    <button class="btn btn-outline" on:click={() => fileInput.click()}><Upload size={16} /> Import</button>
    <button class="btn btn-outline" on:click={exportCsv}><Download size={16} /> CSV</button>
    <button class="btn btn-outline" on:click={exportJson}><FileText size={16} /> JSON</button>
    <button class="btn btn-primary" on:click={() => (showCreate = !showCreate)}><Plus size={16} /> New case</button>
  </svelte:fragment>
</PageHeader>

{#if showCreate}
  <div class="card p-4 mb-4 space-y-3 border-2 border-[var(--color-accent)]">
    <div class="font-medium text-sm">New test case</div>
    <input class="input w-full" placeholder="Title *" bind:value={createForm.title} on:keydown={(e) => e.key === 'Enter' && createNew()} autofocus />
    <div class="flex gap-3">
      <div class="flex-1">
        <label class="label text-xs">Priority</label>
        <select class="input w-full" bind:value={createForm.priority}>
          <option value="P0">P0 – Critical</option>
          <option value="P1">P1 – High</option>
          <option value="P2">P2 – Medium</option>
          <option value="P3">P3 – Low</option>
        </select>
      </div>
      <div class="flex-1">
        <label class="label text-xs">Component</label>
        <input class="input w-full" placeholder="auth, payments…" bind:value={createForm.component} />
      </div>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary" on:click={createNew} disabled={creating || !createForm.title.trim()}>
        <Check size={14} /> {creating ? 'Creating…' : 'Create'}
      </button>
      <button class="btn btn-ghost" on:click={() => { showCreate = false; createForm = { title: '', priority: 'P2', component: '' }; }}><X size={14} /> Cancel</button>
    </div>
  </div>
{/if}

<div class="card">
  <!-- search + filter toolbar -->
  <div class="flex flex-col gap-2 p-3 border-b">
    <div class="flex flex-col md:flex-row items-stretch md:items-center gap-2">
      <div class="relative flex-1">
        <Search size={16} class="absolute left-3 top-2.5 text-[var(--color-muted-foreground)]" />
        <input
          type="text"
          placeholder="Search title or description…"
          class="input pl-9"
          bind:value={query}
          on:input={onQueryInput}
          on:keydown={(e) => e.key === 'Enter' && load()}
        />
      </div>
      <div class="relative">
        <input
          type="text"
          placeholder="Component…"
          class="input w-full md:w-40"
          bind:value={componentFilter}
          on:input={onQueryInput}
        />
      </div>
    </div>

    <!-- priority filter chips + clear -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-xs text-[var(--color-muted-foreground)]">Priority:</span>
      {#each ['P0', 'P1', 'P2', 'P3'] as p}
        <button
          type="button"
          class="btn btn-sm {priorityFilter.includes(p) ? 'btn-primary' : 'btn-outline'}"
          on:click={() => togglePriority(p)}
        >{p}</button>
      {/each}
      {#if hasFilters}
        <button type="button" class="btn btn-sm btn-ghost text-[var(--color-muted-foreground)]" on:click={clearFilters}>
          <X size={12} /> Clear filters
        </button>
      {/if}
      {#if !loading}
        <span class="ml-auto text-xs text-[var(--color-muted-foreground)]">{cases.length} case{cases.length !== 1 ? 's' : ''}</span>
      {/if}
    </div>
  </div>

  {#if selectedIds.length > 0}
    <div class="sticky top-0 z-10 flex flex-wrap items-center gap-2 px-3 py-2 border-b bg-[var(--color-accent)]">
      <span class="text-sm font-medium">{selectedIds.length} selected</span>
      <span class="text-[var(--color-muted-foreground)]">·</span>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={bulkAddTag}><Tag size={14} /> Add tag</button>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={bulkRemoveTag}>Remove tag</button>
      <div class="flex items-center gap-1">
        <span class="text-xs text-[var(--color-muted-foreground)]">Priority:</span>
        {#each ['P0', 'P1', 'P2', 'P3'] as p}
          <button class="btn btn-outline btn-sm px-2" disabled={bulkBusy} on:click={() => bulkSetPriority(p)}>{p}</button>
        {/each}
      </div>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={bulkSetComponent}>Set component</button>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={() => bulk('archive')}><Archive size={14} /> Archive</button>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={() => bulk('restore')}><RotateCcw size={14} /> Restore</button>
      <button class="btn btn-destructive btn-sm" disabled={bulkBusy} on:click={() => bulk('delete')}><Trash2 size={14} /> Delete</button>
      <button class="btn btn-outline btn-sm" disabled={bulkBusy} on:click={bulkSubmitReview}><BookCheck size={14} /> Submit for review</button>
      <div class="flex-1"></div>
      <button class="btn btn-ghost btn-sm" on:click={() => (selected = {})}>Clear</button>
    </div>
  {/if}

  {#if loading}
    <!-- skeleton loader -->
    <div class="divide-y animate-pulse">
      {#each Array(8) as _}
        <div class="flex items-center gap-3 px-3 py-3">
          <div class="w-4 h-4 rounded bg-[var(--color-muted)]"></div>
          <div class="w-16 h-3 rounded bg-[var(--color-muted)]"></div>
          <div class="w-8 h-5 rounded-full bg-[var(--color-muted)]"></div>
          <div class="flex-1 h-3 rounded bg-[var(--color-muted)]"></div>
          <div class="w-24 h-3 rounded bg-[var(--color-muted)] hidden md:block"></div>
          <div class="w-16 h-3 rounded bg-[var(--color-muted)] hidden md:block"></div>
        </div>
      {/each}
    </div>
  {:else if cases.length === 0}
    <div class="p-12 text-center">
      <div class="text-sm text-[var(--color-muted-foreground)] mb-3">
        {hasFilters ? 'No cases match the current filters.' : 'No test cases yet.'}
      </div>
      {#if hasFilters}
        <button class="btn btn-outline mr-2" on:click={clearFilters}>Clear filters</button>
      {/if}
      <button class="btn btn-primary" on:click={() => (showCreate = true)}><Plus size={16} /> Create your first case</button>
    </div>
  {:else}
    <div class="table-wrap">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
          <tr class="text-left">
            <th class="px-3 py-2 w-8">
              <input type="checkbox" checked={allSelected} on:change={toggleAll} />
            </th>
            <th class="px-3 py-2 w-20">Code</th>
            <th class="px-3 py-2 w-12">Pri</th>
            <th class="px-3 py-2">Title</th>
            <th class="px-3 py-2 hidden md:table-cell">Component</th>
            <th class="px-3 py-2 hidden md:table-cell">Tags</th>
            <th class="px-3 py-2 hidden lg:table-cell">Review</th>
            <th class="px-3 py-2 hidden lg:table-cell">Updated</th>
          </tr>
        </thead>
        <tbody>
          {#each cases as c}
            <tr class="border-t table-row-hover">
              <td class="px-3 py-3" on:click|stopPropagation>
                <input type="checkbox" bind:checked={selected[c.id]} />
              </td>
              <td class="px-3 py-3 font-mono text-xs text-[var(--color-muted-foreground)] cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>{c.code}</td>
              <td class="px-3 py-3 cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}><span class={priorityClass(c.priority)}>{c.priority}</span></td>
              <td class="px-3 py-3 font-medium cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>{c.title}</td>
              <td class="px-3 py-3 hidden md:table-cell text-[var(--color-muted-foreground)] cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>{c.component || '—'}</td>
              <td class="px-3 py-3 hidden md:table-cell cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>
                <div class="flex flex-wrap gap-1">
                  {#each c.tags as t}<span class="badge">{t}</span>{/each}
                </div>
              </td>
              <td class="px-3 py-3 hidden lg:table-cell cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>
                {#if c.review_status && c.review_status !== 'draft'}
                  <span class={reviewBadge(c.review_status)}>{c.review_status.replace('_', ' ')}</span>
                {:else}
                  <span class="text-[var(--color-muted-foreground)]">—</span>
                {/if}
              </td>
              <td class="px-3 py-3 hidden lg:table-cell text-[var(--color-muted-foreground)] cursor-pointer" on:click={() => goto(`/${slug}/cases/${c.id}`)}>{formatDate(c.updated_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
