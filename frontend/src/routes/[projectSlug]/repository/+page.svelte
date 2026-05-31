<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Suite, TestCase } from '$lib/api';
  import PriorityArrow from '$lib/components/PriorityArrow.svelte';
  import {
    ChevronDown, ChevronRight, ChevronsDown, ChevronsUp,
    Plus, Pencil, Copy, Trash2, Search, Hand, MoreHorizontal, Filter,
  } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { modal } from '$lib/modal-store';

  $: slug = $page.params.projectSlug;

  type CasePayload = {
    id: string; code: string; title: string; priority: string;
    component: string; tags: string[];
  };

  let suites: Suite[] = [];
  let suiteCases: Record<string, CasePayload[]> = {};
  let allCases: TestCase[] = [];
  let loading = true;
  let query = '';

  // tree state
  let selectedSuiteId: string | null = null;
  let collapsedTree: Record<string, boolean> = {};
  let collapsedBlocks: Record<string, boolean> = {};

  // quick-create state per suite
  let quickFor: string | null = null;
  let quickTitle = '';
  let quickPriority = 'P2';
  let priorityOpen = false;

  // suite editing
  let renamingFor: string | null = null;
  let treeMenuFor: string | null = null;
  let treeMenuPos = { x: 0, y: 0 };

  function openTreeMenu(e: MouseEvent, id: string) {
    if (treeMenuFor === id) { treeMenuFor = null; return; }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    treeMenuPos = { x: rect.right, y: rect.bottom + 4 };
    treeMenuFor = id;
  }
  let renameValue = '';

  // metrics
  $: rootSuites = suites
    .filter((s) => !s.parent_id)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  $: descendantsOfSelected = selectedSuiteId
    ? collectSubtree(selectedSuiteId, suites)
    : suites.map((s) => s.id);

  $: visibleSuites = suites
    .filter((s) => descendantsOfSelected.includes(s.id))
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  $: totalCases = allCases.length;
  $: totalSuites = suites.length;

  function collectSubtree(rootId: string, list: Suite[]): string[] {
    const out: string[] = [rootId];
    const queue = [rootId];
    while (queue.length) {
      const parent = queue.shift()!;
      for (const s of list) if (s.parent_id === parent) { out.push(s.id); queue.push(s.id); }
    }
    return out;
  }

  function childrenOf(parentId: string | null): Suite[] {
    return suites
      .filter((s) => (parentId ? s.parent_id === parentId : !s.parent_id))
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }

  async function load() {
    loading = true;
    [suites, allCases] = await Promise.all([
      api.get<Suite[]>('/suites'),
      api.get<TestCase[]>('/cases?limit=500'),
    ]);
    suiteCases = {};
    // Resolve cases for each suite in parallel
    await Promise.all(
      suites.map(async (s) => {
        try {
          suiteCases[s.id] = await api.get<CasePayload[]>(`/suites/${s.id}/cases`);
        } catch {
          suiteCases[s.id] = [];
        }
      })
    );
    loading = false;
  }

  function filterCases(list: CasePayload[]): CasePayload[] {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      (c.component || '').toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  function expandAll() { collapsedBlocks = {}; collapsedTree = {}; }
  function collapseAll() {
    const next: Record<string, boolean> = {};
    for (const s of suites) next[s.id] = true;
    collapsedBlocks = { ...next };
    collapsedTree = { ...next };
  }

  async function quickCreate(suite: Suite) {
    if (!quickTitle.trim()) return;
    const created = await api.post<{ id: string; code: string; title: string; priority: string }>(
      `/suites/${suite.id}/quick-case`,
      { title: quickTitle.trim(), priority: quickPriority }
    );
    const entry: CasePayload = { ...created, component: '', tags: [] };
    suiteCases = { ...suiteCases, [suite.id]: [...(suiteCases[suite.id] ?? []), entry] };
    allCases = [...allCases, entry as unknown as TestCase];
    quickTitle = '';
    quickFor = null;
  }

  async function removeCaseFromSuite(suiteId: string, caseId: string) {
    if (!await modal.confirm('Remove case', 'This case will be removed from the suite.', { confirmLabel: 'Remove' })) return;
    await api.del(`/suites/${suiteId}/cases/${caseId}`);
    suiteCases = { ...suiteCases, [suiteId]: (suiteCases[suiteId] ?? []).filter((c) => c.id !== caseId) };
  }

  async function deleteSuite(s: Suite) {
    if (!await modal.confirm('Delete suite', `"${s.name}" and all its cases will be removed from this suite. This cannot be undone.`, { destructive: true })) return;
    await api.del(`/suites/${s.id}`);
    suites = suites
      .filter((x) => x.id !== s.id)
      .map((x) => x.parent_id === s.id ? { ...x, parent_id: s.parent_id } : x);
    const { [s.id]: _removed, ...restCases } = suiteCases;
    suiteCases = restCases;
    if (selectedSuiteId === s.id) selectedSuiteId = null;
  }

  async function createSibling(parentId: string | null) {
    const name = await modal.prompt('New suite', { placeholder: 'Suite name' });
    if (!name) return;
    const created = await api.post<Suite>('/suites', {
      name, description: '', type: 'static', parent_id: parentId,
      static_case_ids: [], filter: { tags_in: [], components_in: [], priorities_in: [], include_archived: false, query: '' },
    });
    suites = [...suites, created];
    suiteCases = { ...suiteCases, [created.id]: [] };
  }

  async function renameSuite(s: Suite) {
    const newName = await modal.prompt('Rename suite', { defaultValue: s.name, placeholder: 'Suite name', confirmLabel: 'Rename' });
    if (!newName || newName.trim() === s.name) return;
    const updated = await api.put<Suite>(`/suites/${s.id}`, {
      name: newName.trim(), description: s.description, parent_id: s.parent_id,
      type: s.type, static_case_ids: s.static_case_ids, filter: s.filter,
    });
    suites = suites.map((x) => x.id === updated.id ? updated : x);
  }

  function startRename(s: Suite) {
    renamingFor = s.id;
    renameValue = s.name;
  }
  async function commitRename(s: Suite) {
    if (!renameValue.trim() || renameValue === s.name) {
      renamingFor = null;
      return;
    }
    const updated = await api.put<Suite>(`/suites/${s.id}`, {
      name: renameValue.trim(),
      description: s.description,
      parent_id: s.parent_id,
      type: s.type,
      static_case_ids: s.static_case_ids,
      filter: s.filter,
    });
    suites = suites.map((x) => x.id === updated.id ? updated : x);
    renamingFor = null;
  }

  async function duplicateSuite(s: Suite) {
    const created = await api.post<Suite>('/suites', {
      name: s.name + ' (copy)',
      description: s.description,
      type: s.type,
      parent_id: s.parent_id,
      static_case_ids: s.static_case_ids,
      filter: s.filter,
    });
    suites = [...suites, created];
    suiteCases = { ...suiteCases, [created.id]: [] };
  }

  async function startRun(s: Suite) {
    const name = await modal.prompt('Start run', { defaultValue: `${s.name} — ${new Date().toISOString().slice(0, 10)}`, placeholder: 'Run name', confirmLabel: 'Start' });
    if (!name) return;
    const run = await api.post<{ id: string }>('/runs', { name, suite_id: s.id });
    await goto(`/${slug}/runs/${run.id}`);
  }

  onMount(load);
</script>

<!-- Page header strip -->
<div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-4 mb-4 border-b">
  <div>
    <h1 class="text-xl font-semibold tracking-tight">
      Repository
      <span class="text-sm font-normal text-[var(--color-muted-foreground)] ml-2">
        {totalCases} case{totalCases === 1 ? '' : 's'} ({totalCases}) · {totalSuites} suite{totalSuites === 1 ? '' : 's'} ({totalSuites})
      </span>
    </h1>
  </div>
  <div class="flex items-center gap-2">
    <button class="btn btn-outline" on:click={() => createSibling(null)}>
      <Plus size={16} /> New suite
    </button>
    <button class="btn btn-primary" on:click={() => goto(`/${slug}/cases`)}>
      <Plus size={16} /> Manual test
    </button>
  </div>
</div>

<!-- Filter bar -->
<div class="flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-4">
  <div class="relative flex-1">
    <Search size={14} class="absolute left-3 top-2.5 text-[var(--color-muted-foreground)]" />
    <input class="input pl-9" placeholder="Search" bind:value={query} />
  </div>
  <select class="input w-44">
    <option>By all fields</option>
    <option>By title</option>
    <option>By tags</option>
    <option>By component</option>
  </select>
  <button class="btn btn-ghost text-[var(--color-info)] text-sm">
    <Filter size={14} /> Add filter
  </button>
</div>

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else}
  <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
    <!-- LEFT: suites tree -->
    <aside class="card overflow-hidden">
      <div class="flex items-center justify-between px-3 py-2 border-b">
        <div class="text-sm font-semibold flex items-center gap-2">
          Suites
          <button
            class="btn btn-ghost px-1.5"
            title="New top-level suite"
            on:click={() => createSibling(null)}
          >
            <Plus size={14} />
          </button>
        </div>
        <div class="flex items-center gap-1">
          <button class="btn btn-ghost px-1.5" title="Collapse all" on:click={collapseAll}>
            <ChevronsUp size={14} />
          </button>
          <button class="btn btn-ghost px-1.5" title="Expand all" on:click={expandAll}>
            <ChevronsDown size={14} />
          </button>
        </div>
      </div>
      <ul class="py-1 text-sm max-h-[70vh] overflow-y-auto">
        <li>
          <button
            type="button"
            class="w-full text-left px-3 py-1.5 flex items-center gap-2 {selectedSuiteId === null
              ? 'bg-[var(--color-accent)] font-medium'
              : 'hover:bg-[var(--color-muted)]'}"
            on:click={() => (selectedSuiteId = null)}
          >
            <span class="text-[var(--color-muted-foreground)]">All</span>
            <span class="ml-auto text-xs text-[var(--color-muted-foreground)]">{totalSuites}</span>
          </button>
        </li>
        {#each rootSuites as s}
          {@render suiteRow(s, 0)}
        {/each}
      </ul>
    </aside>

    <!-- RIGHT: suites with cases -->
    <div class="space-y-4">
      {#if visibleSuites.length === 0}
        <div class="card p-12 text-center text-sm text-[var(--color-muted-foreground)]">
          No suites yet — create one to organize your cases.
        </div>
      {/if}
      {#each visibleSuites as s}
        {@const cases = filterCases(suiteCases[s.id] || [])}
        {@const isCollapsed = collapsedBlocks[s.id]}
        <section class="card overflow-hidden">
          <!-- Suite header strip -->
          <header class="flex items-center gap-2 px-4 py-2.5 border-b bg-[var(--color-muted)]/50">
            <button class="text-[var(--color-muted-foreground)]" on:click={() => (collapsedBlocks = { ...collapsedBlocks, [s.id]: !isCollapsed })}>
              {#if isCollapsed}<ChevronRight size={16} />{:else}<ChevronDown size={16} />{/if}
            </button>
            {#if renamingFor === s.id}
              <input
                class="input h-7 max-w-xs"
                bind:value={renameValue}
                on:keydown={(e) => e.key === 'Enter' && commitRename(s)}
                on:blur={() => commitRename(s)}
                autofocus
              />
            {:else}
              <button class="font-semibold hover:underline" on:click={() => (selectedSuiteId = s.id)}>{s.name}</button>
            {/if}
            <button class="btn btn-ghost px-1.5" title="New child suite" on:click={() => createSibling(s.id)}>
              <Plus size={14} />
            </button>
            <button class="btn btn-ghost px-1.5" title="Rename" on:click={() => startRename(s)}>
              <Pencil size={14} />
            </button>
            <button class="btn btn-ghost px-1.5" title="Duplicate" on:click={() => duplicateSuite(s)}>
              <Copy size={14} />
            </button>
            <button class="btn btn-ghost px-1.5" title="Delete" on:click={() => deleteSuite(s)}>
              <Trash2 size={14} />
            </button>
            <div class="flex-1"></div>
            <span class="text-xs text-[var(--color-muted-foreground)]">{cases.length} case{cases.length === 1 ? '' : 's'}</span>
            <button class="btn btn-outline" on:click={() => startRun(s)}>Start run</button>
          </header>

          {#if !isCollapsed}
            {#if s.description}
              <p class="text-sm text-[var(--color-muted-foreground)] px-4 py-2 border-b">{s.description}</p>
            {/if}
            <ul class="divide-y">
              {#each cases as c}
                <li
                  class="group flex items-center gap-3 px-4 py-2 text-sm hover:bg-[var(--color-muted)]/40 cursor-pointer"
                  on:click={() => goto(`/${slug}/cases/${c.id}`)}
                >
                  <PriorityArrow priority={c.priority} />
                  <span class="text-[var(--color-muted-foreground)]" title="Manual"><Hand size={14} /></span>
                  <span class="font-mono text-xs text-[var(--color-muted-foreground)] w-20 shrink-0">{c.code}</span>
                  <span class="flex-1 truncate">{c.title}</span>
                  {#if c.tags.length}
                    <span class="hidden md:flex gap-1">
                      {#each c.tags.slice(0, 3) as t}<span class="badge">{t}</span>{/each}
                    </span>
                  {/if}
                  {#if s.type === 'static'}
                    <button
                      class="opacity-0 group-hover:opacity-100 btn btn-ghost px-1.5"
                      on:click|stopPropagation={() => removeCaseFromSuite(s.id, c.id)}
                      title="Remove from suite"
                    >
                      <Trash2 size={14} />
                    </button>
                  {/if}
                </li>
              {/each}
            </ul>

            {#if s.type === 'static'}
              <div class="px-4 py-2 border-t bg-[var(--color-background)]">
                {#if quickFor === s.id}
                  <div class="flex items-center gap-2">
                    <!-- icon priority picker -->
                    <div class="relative shrink-0">
                      <button
                        type="button"
                        class="btn btn-outline btn-sm flex items-center gap-1.5"
                        on:click={() => (priorityOpen = !priorityOpen)}
                      >
                        <PriorityArrow priority={quickPriority} />
                        <span class="font-mono text-xs">{quickPriority}</span>
                        <ChevronDown size={11} class="text-[var(--color-muted-foreground)]" />
                      </button>
                      {#if priorityOpen}
                        <div class="fixed inset-0 z-10" on:click={() => (priorityOpen = false)} aria-hidden="true"></div>
                        <div class="absolute left-0 top-full mt-1 card z-20 py-1 shadow-lg" role="menu">
                          {#each [['P0','Critical'],['P1','High'],['P2','Medium'],['P3','Low']] as [p, label]}
                            <button
                              type="button"
                              class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] {quickPriority === p ? 'bg-[var(--color-accent)]' : ''}"
                              on:click={() => { quickPriority = p; priorityOpen = false; }}
                            >
                              <PriorityArrow priority={p} />
                              <span class="font-mono text-xs font-medium">{p}</span>
                              <span class="text-xs text-[var(--color-muted-foreground)]">{label}</span>
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <input
                      style="flex: 1; min-width: 0;"
                      class="input btn-sm"
                      placeholder="Quick test title…"
                      bind:value={quickTitle}
                      on:keydown={(e) => e.key === 'Enter' && quickCreate(s)}
                      autofocus
                    />
                    <button class="btn btn-primary btn-sm shrink-0" on:click={() => quickCreate(s)}>Create</button>
                    <button class="btn btn-ghost btn-sm shrink-0" on:click={() => { quickFor = null; quickTitle = ''; }}>Cancel</button>
                  </div>
                {:else}
                  <button class="text-sm text-[var(--color-info)] hover:underline flex items-center gap-1" on:click={() => (quickFor = s.id)}>
                    <Plus size={14} /> Create quick test
                  </button>
                {/if}
              </div>
            {:else}
              <div class="px-4 py-2 border-t text-xs text-[var(--color-muted-foreground)] italic">
                Dynamic suite — cases come from filters.
              </div>
            {/if}
          {/if}
        </section>
      {/each}
    </div>
  </div>
{/if}

{#if treeMenuFor}
  <div class="fixed inset-0 z-10" on:click={() => (treeMenuFor = null)} aria-hidden="true"></div>
  <div class="fixed z-20 card py-1 shadow-lg w-36 text-sm" style="left: {treeMenuPos.x}px; top: {treeMenuPos.y}px; transform: translateX(-100%);">
    {#each suites.filter(s => s.id === treeMenuFor) as s}
      <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-muted)]" on:click={() => { treeMenuFor = null; renameSuite(s); }}>Rename</button>
      <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-muted)]" on:click={() => { treeMenuFor = null; createSibling(s.id); }}>Add child</button>
      <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-muted)]" on:click={() => { treeMenuFor = null; duplicateSuite(s); }}>Duplicate</button>
      <div class="border-t my-1"></div>
      <button class="w-full text-left px-3 py-1.5 hover:bg-[var(--color-muted)] text-[var(--color-destructive)]" on:click={() => { treeMenuFor = null; deleteSuite(s); }}>Delete</button>
    {/each}
  </div>
{/if}

{#snippet suiteRow(s: Suite, depth: number)}
  {@const isCollapsed = collapsedTree[s.id]}
  {@const kids = childrenOf(s.id)}
  {@const count = (suiteCases[s.id] || []).length}
  <li>
    <div
      class="flex items-center gap-1 pr-2 py-1 text-sm rounded-md mx-1 {selectedSuiteId === s.id
        ? 'bg-[var(--color-accent)] font-medium'
        : 'hover:bg-[var(--color-muted)]'}"
      style="padding-left: {depth * 14 + 8}px;"
    >
      {#if kids.length}
        <button class="text-[var(--color-muted-foreground)]" on:click={() => (collapsedTree = { ...collapsedTree, [s.id]: !isCollapsed })}>
          {#if isCollapsed}<ChevronRight size={12} />{:else}<ChevronDown size={12} />{/if}
        </button>
      {:else}
        <span style="width: 12px;"></span>
      {/if}
      <button
        type="button"
        class="flex-1 text-left truncate"
        on:click={() => (selectedSuiteId = s.id)}
      >
        {s.name}
      </button>
      <span class="text-xs text-[var(--color-muted-foreground)]">{count}</span>
      <button class="opacity-50 hover:opacity-100" title="More" on:click|stopPropagation={(e) => openTreeMenu(e, s.id)}>
        <MoreHorizontal size={12} />
      </button>
    </div>
    {#if !isCollapsed && kids.length}
      <ul>
        {#each kids as k}
          {@render suiteRow(k, depth + 1)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}
