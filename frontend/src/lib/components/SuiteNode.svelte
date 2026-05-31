<script lang="ts">
  import type { Suite } from '$lib/api';
  import { api } from '$lib/api';
  import { ChevronDown, ChevronRight, FolderTree, Filter, PlayCircle, GripVertical, Trash2, ListTodo, Plus, X, Search, Pencil } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';

  export let suite: Suite;
  export let children: Suite[];
  export let allSuites: Suite[];
  export let depth = 0;
  export let collapsed: Record<string, boolean>;
  export let dragId: string | null;
  export let overInfo: { id: string; where: 'before' | 'into' | 'after' } | null;
  export let editingId: string | null = null;

  const dispatch = createEventDispatcher<{
    toggle: { id: string };
    run: { suite: Suite };
    edit: { suite: Suite };
    remove: { suite: Suite };
    dragstart: { id: string };
    dragover: { clientY: number; rect: { top: number; height: number }; targetId: string };
    drop: { targetId: string };
    casechange: { suiteId: string };
  }>();

  // Cases panel
  let showCases = false;
  let casesLoading = false;
  let cases: Array<{ id: string; code: string; title: string; priority: string }> = [];
  let quickTitle = '';
  let quickAdding = false;
  let searchQ = '';
  let searchResults: Array<{ id: string; code: string; title: string }> = [];
  let searching = false;
  let searchTimer: ReturnType<typeof setTimeout>;

  $: displayCount = showCases ? cases.length : suite.case_count;

  async function toggleCases() {
    showCases = !showCases;
    if (showCases) await loadCases();
  }

  async function loadCases() {
    casesLoading = true;
    try {
      cases = await api.get(`/suites/${suite.id}/cases`);
    } finally {
      casesLoading = false;
    }
  }

  async function quickAdd() {
    if (!quickTitle.trim() || quickAdding) return;
    quickAdding = true;
    try {
      await api.post(`/suites/${suite.id}/quick-case`, { title: quickTitle.trim() });
      quickTitle = '';
      await loadCases();
      dispatch('casechange', { suiteId: suite.id });
    } finally {
      quickAdding = false;
    }
  }

  async function removeCase(caseId: string) {
    await api.del(`/suites/${suite.id}/cases/${caseId}`);
    cases = cases.filter((c) => c.id !== caseId);
    dispatch('casechange', { suiteId: suite.id });
  }

  function onSearchInput() {
    clearTimeout(searchTimer);
    if (!searchQ.trim()) { searchResults = []; return; }
    searchTimer = setTimeout(async () => {
      searching = true;
      try {
        const results = await api.get<Array<{ id: string; code: string; title: string }>>(`/cases?q=${encodeURIComponent(searchQ)}&limit=10`);
        const existingIds = new Set(cases.map((c) => c.id));
        searchResults = results.filter((r) => !existingIds.has(r.id));
      } finally {
        searching = false;
      }
    }, 300);
  }

  async function addExistingCase(c: { id: string; code: string; title: string }) {
    await api.post(`/suites/${suite.id}/cases/${c.id}`);
    searchQ = '';
    searchResults = [];
    await loadCases();
    dispatch('casechange', { suiteId: suite.id });
  }

  $: isOpen = !collapsed[suite.id];
  $: childList = allSuites
    .filter((s) => s.parent_id === suite.id)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  function onDragStart(e: DragEvent) {
    if (!e.dataTransfer) return;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', suite.id);
    dispatch('dragstart', { id: suite.id });
  }
  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    dispatch('dragover', { clientY: e.clientY, rect: { top: r.top, height: r.height }, targetId: suite.id });
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dispatch('drop', { targetId: suite.id });
  }

  $: rowClass = (() => {
    if (dragId === suite.id) return 'dnd-dragging';
    if (overInfo && overInfo.id === suite.id && overInfo.where === 'into') return 'dnd-over';
    return '';
  })();

  $: beforeBarVisible = overInfo && overInfo.id === suite.id && overInfo.where === 'before';
  $: afterBarVisible = overInfo && overInfo.id === suite.id && overInfo.where === 'after';
</script>

<div>
  {#if beforeBarVisible}
    <div class="h-0.5 bg-[var(--color-info)] rounded" style="margin-left: {depth * 18 + 8}px;"></div>
  {/if}

  <div
    class="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--color-muted)] {rowClass} {editingId === suite.id ? 'ring-1 ring-[var(--color-primary)] ring-inset' : ''}"
    style="padding-left: {depth * 18 + 8}px;"
    draggable="true"
    on:dragstart={onDragStart}
    on:dragover={onDragOver}
    on:drop={onDrop}
  >
    <span class="text-[var(--color-muted-foreground)] cursor-grab" title="Drag to reorder">
      <GripVertical size={14} />
    </span>

    {#if childList.length}
      <button
        type="button"
        class="text-[var(--color-muted-foreground)]"
        on:click={() => dispatch('toggle', { id: suite.id })}
      >
        {#if isOpen}<ChevronDown size={14} />{:else}<ChevronRight size={14} />{/if}
      </button>
    {:else}
      <span style="width: 14px;"></span>
    {/if}

    {#if suite.type === 'dynamic'}
      <Filter size={14} class="text-[var(--color-info)]" />
    {:else}
      <FolderTree size={14} class="text-[var(--color-muted-foreground)]" />
    {/if}

    <span class="text-sm flex-1 truncate">{suite.name}</span>
    <span class="badge">{displayCount}</span>
    <span class="badge">{suite.type}</span>

    <button class="btn btn-ghost px-2 {showCases ? 'text-[var(--color-primary)]' : ''}" on:click|stopPropagation={toggleCases} title="Manage cases">
      <ListTodo size={14} />
    </button>
    <button class="btn btn-ghost px-2 {editingId === suite.id ? 'text-[var(--color-primary)]' : ''}" on:click={() => dispatch('edit', { suite })} title="Edit suite">
      <Pencil size={14} />
    </button>
    <button class="btn btn-ghost px-2" on:click={() => dispatch('run', { suite })} title="Start run">
      <PlayCircle size={14} />
    </button>
    <button class="btn btn-ghost px-2 text-[var(--color-destructive)]" on:click={() => dispatch('remove', { suite })} title="Delete suite">
      <Trash2 size={14} />
    </button>
  </div>

  {#if showCases}
    <div class="border-l-2 border-[var(--color-border)] ml-6 pl-3 py-2 space-y-1" style="margin-left: {depth * 18 + 22}px;">
      {#if casesLoading}
        <p class="text-xs text-[var(--color-muted-foreground)]">Loading…</p>
      {:else if cases.length === 0}
        <p class="text-xs text-[var(--color-muted-foreground)]">No cases in this suite.</p>
      {:else}
        {#each cases as c (c.id)}
          <div class="flex items-center gap-2 text-xs group">
            <span class="font-mono text-[var(--color-muted-foreground)] shrink-0">{c.code}</span>
            <span class="flex-1 truncate">{c.title}</span>
            <span class="badge shrink-0">{c.priority}</span>
            {#if suite.type === 'static'}
              <button class="opacity-0 group-hover:opacity-100 text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]" on:click={() => removeCase(c.id)} title="Remove from suite">
                <X size={12} />
              </button>
            {/if}
          </div>
        {/each}
      {/if}

      {#if suite.type === 'static'}
        <div class="pt-2 space-y-2">
          <div class="flex gap-1">
            <input
              class="input text-xs flex-1 h-7 py-0"
              placeholder="New case title…"
              bind:value={quickTitle}
              on:keydown={(e) => e.key === 'Enter' && quickAdd()}
            />
            <button class="btn btn-primary h-7 px-2 text-xs" disabled={!quickTitle.trim() || quickAdding} on:click={quickAdd}>
              <Plus size={12} />
            </button>
          </div>

          <div class="relative">
            <div class="flex gap-1 items-center">
              <Search size={12} class="text-[var(--color-muted-foreground)] shrink-0" />
              <input
                class="input text-xs flex-1 h-7 py-0"
                placeholder="Add existing case…"
                bind:value={searchQ}
                on:input={onSearchInput}
              />
            </div>
            {#if searchResults.length > 0}
              <div class="absolute z-10 left-0 right-0 mt-1 card shadow-lg divide-y divide-[var(--color-border)] max-h-48 overflow-y-auto">
                {#each searchResults as r (r.id)}
                  <button
                    class="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-muted)] flex gap-2 items-center"
                    on:click={() => addExistingCase(r)}
                  >
                    <span class="font-mono text-[var(--color-muted-foreground)] shrink-0">{r.code}</span>
                    <span class="truncate">{r.title}</span>
                  </button>
                {/each}
              </div>
            {:else if searching}
              <p class="text-xs text-[var(--color-muted-foreground)] mt-1 pl-5">Searching…</p>
            {/if}
          </div>
        </div>
      {/if}
    </div>
  {/if}

  {#if afterBarVisible}
    <div class="h-0.5 bg-[var(--color-info)] rounded" style="margin-left: {depth * 18 + 8}px;"></div>
  {/if}

  {#if isOpen && childList.length}
    {#each childList as child}
      <svelte:self
        suite={child}
        {allSuites}
        children={[]}
        depth={depth + 1}
        bind:collapsed
        {dragId}
        {overInfo}
        {editingId}
        on:toggle
        on:run
        on:edit
        on:remove
        on:dragstart
        on:dragover
        on:drop
        on:casechange
      />
    {/each}
  {/if}
</div>
