<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Suite } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import SuiteNode from '$lib/components/SuiteNode.svelte';
  import { Plus, FolderTree, Search, X } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { modal } from '$lib/modal-store';

  $: slug = $page.params.projectSlug;

  let suites: Suite[] = [];
  let loading = true;
  let collapsed: Record<string, boolean> = {};

  // DnD state
  let dragId: string | null = null;
  let overInfo: { id: string; where: 'before' | 'into' | 'after' } | null = null;

  // Create/Edit form
  let showForm = false;
  let editingId: string | null = null;
  let newName = '';
  let newDescription = '';
  let newType: 'static' | 'dynamic' = 'dynamic';
  let newParent: string = '';
  let newTags = '';
  let newComponents = '';
  let newPriorities = '';
  let saving = false;

  // Case picker (for static suites)
  type CaseRef = { id: string; code: string; title: string };
  let formCases: CaseRef[] = [];
  let formSearchQ = '';
  let formSearchResults: CaseRef[] = [];
  let formSearching = false;
  let formSearchTimer: ReturnType<typeof setTimeout>;

  $: rootSuites = suites
    .filter((s) => !s.parent_id)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  $: formTitle = editingId ? 'Edit suite' : 'Create a suite';
  $: saveLabel = saving ? (editingId ? 'Saving…' : 'Creating…') : (editingId ? 'Save changes' : 'Create suite');

  async function load() {
    loading = true;
    suites = await api.get<Suite[]>('/suites');
    loading = false;
  }

  function cancelForm() {
    showForm = false;
    editingId = null;
    newName = newDescription = newTags = newComponents = newPriorities = newParent = '';
    newType = 'dynamic';
    formCases = [];
    formSearchQ = '';
    formSearchResults = [];
  }

  function openNewForm() {
    if (showForm && !editingId) { cancelForm(); return; }
    cancelForm();
    showForm = true;
  }

  async function startEdit(s: Suite) {
    cancelForm();
    editingId = s.id;
    newName = s.name;
    newDescription = s.description;
    newType = s.type;
    newParent = s.parent_id || '';
    newTags = s.filter.tags_in.join(', ');
    newComponents = s.filter.components_in.join(', ');
    newPriorities = s.filter.priorities_in.join(', ');
    formCases = [];
    if (s.type === 'static' && s.case_count > 0) {
      const cases = await api.get<Array<{ id: string; code: string; title: string; priority: string }>>(`/suites/${s.id}/cases`);
      formCases = cases.map((c) => ({ id: c.id, code: c.code, title: c.title }));
    }
    showForm = true;
  }

  async function saveSuite() {
    if (!newName || saving) return;
    saving = true;
    try {
      const payload = {
        name: newName,
        description: newDescription,
        type: newType,
        parent_id: newParent || null,
        static_case_ids: newType === 'static' ? formCases.map((c) => c.id) : [],
        filter: {
          tags_in: newTags.split(',').map((t) => t.trim()).filter(Boolean),
          components_in: newComponents.split(',').map((t) => t.trim()).filter(Boolean),
          priorities_in: newPriorities.split(',').map((t) => t.trim()).filter(Boolean),
          include_archived: false,
          query: '',
        },
      };
      if (editingId) {
        const updated = await api.put<Suite>(`/suites/${editingId}`, payload);
        suites = suites.map((s) => s.id === updated.id ? updated : s);
      } else {
        const created = await api.post<Suite>('/suites', payload);
        suites = [...suites, created];
      }
      cancelForm();
    } finally {
      saving = false;
    }
  }

  function onFormSearchInput() {
    clearTimeout(formSearchTimer);
    if (!formSearchQ.trim()) { formSearchResults = []; return; }
    formSearchTimer = setTimeout(async () => {
      formSearching = true;
      try {
        const results = await api.get<CaseRef[]>(`/cases?q=${encodeURIComponent(formSearchQ)}&limit=10`);
        const existingIds = new Set(formCases.map((c) => c.id));
        formSearchResults = results.filter((r) => !existingIds.has(r.id));
      } finally {
        formSearching = false;
      }
    }, 300);
  }

  function addCaseToForm(c: CaseRef) {
    formCases = [...formCases, c];
    formSearchQ = '';
    formSearchResults = [];
  }

  function removeCaseFromForm(id: string) {
    formCases = formCases.filter((c) => c.id !== id);
  }

  async function startRun(s: Suite) {
    const name = await modal.prompt('Start run', { defaultValue: `${s.name} — ${new Date().toISOString().slice(0, 10)}`, placeholder: 'Run name', confirmLabel: 'Start' });
    if (!name) return;
    const run = await api.post<{ id: string }>('/runs', { name, suite_id: s.id });
    await goto(`/${slug}/runs/${run.id}`);
  }

  async function removeSuite(s: Suite) {
    if (!await modal.confirm('Delete suite', `Delete "${s.name}"? Child suites will be reparented.`, { destructive: true })) return;
    await api.del(`/suites/${s.id}`);
    suites = suites
      .filter((x) => x.id !== s.id)
      .map((x) => x.parent_id === s.id ? { ...x, parent_id: s.parent_id } : x);
  }

  function toggle(id: string) {
    collapsed = { ...collapsed, [id]: !collapsed[id] };
  }

  function getDescendantIds(rootId: string): Set<string> {
    const ids = new Set<string>();
    const queue = [rootId];
    while (queue.length) {
      const pid = queue.shift()!;
      for (const s of suites) {
        if (s.parent_id === pid) { ids.add(s.id); queue.push(s.id); }
      }
    }
    return ids;
  }

  function onDragStart(detail: { id: string }) {
    dragId = detail.id;
  }
  function onDragOver(detail: { clientY: number; rect: { top: number; height: number }; targetId: string }) {
    const { clientY, rect, targetId } = detail;
    const y = clientY - rect.top;
    const h = rect.height;
    let where: 'before' | 'into' | 'after';
    if (y < h * 0.25) where = 'before';
    else if (y > h * 0.75) where = 'after';
    else where = 'into';
    overInfo = { id: targetId, where };
  }
  async function onDrop(detail: { targetId: string }) {
    if (!dragId || !overInfo) return;
    const src = suites.find((s) => s.id === dragId);
    const tgt = suites.find((s) => s.id === overInfo!.id);
    if (!src || !tgt || src.id === tgt.id) { resetDnd(); return; }

    let parent_id: string | null;
    let position: number;
    if (overInfo.where === 'into') {
      parent_id = tgt.id;
      position = 0;
    } else {
      parent_id = tgt.parent_id || null;
      position = tgt.position + (overInfo.where === 'after' ? 1 : 0);
    }

    // Prevent circular: new parent cannot be src itself or any of its descendants
    const descendants = getDescendantIds(src.id);
    if (parent_id === src.id || (parent_id !== null && descendants.has(parent_id))) {
      resetDnd();
      return;
    }

    try {
      const updated = await api.post<Suite>(`/suites/${src.id}/reparent`, { parent_id, position });
      suites = suites.map((s) => {
        if (s.id === src.id) return updated;
        if (s.parent_id === parent_id && s.id !== src.id && s.position >= position) return { ...s, position: s.position + 1 };
        return s;
      });
    } catch {
      // error toast shown automatically
    } finally {
      resetDnd();
    }
  }
  function resetDnd() {
    dragId = null;
    overInfo = null;
  }

  async function onCaseChange(e: CustomEvent<{ suiteId: string }>) {
    const updated = await api.get<Suite>(`/suites/${e.detail.suiteId}`);
    suites = suites.map((s) => s.id === updated.id ? updated : s);
  }

  onMount(load);
</script>

<PageHeader title="Suites" subtitle="Hierarchical groups — drag to reorder, drop into to nest.">
  <button slot="actions" class="btn btn-primary" on:click={openNewForm}>
    <Plus size={16} /> {showForm && !editingId ? 'Cancel' : 'New suite'}
  </button>
</PageHeader>

{#if showForm}
  <div class="card p-5 mb-6 space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-semibold">{formTitle}</h2>
      {#if editingId}
        <button class="btn btn-ghost text-xs" on:click={cancelForm}>Cancel</button>
      {/if}
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Name</label>
        <input class="input" bind:value={newName} placeholder="Smoke — pre-release" />
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Type</label>
        <select class="input" bind:value={newType}>
          <option value="dynamic">Dynamic (filter)</option>
          <option value="static">Static (manual list)</option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Parent suite</label>
        <select class="input" bind:value={newParent}>
          <option value="">(top level)</option>
          {#each suites.filter(s => s.id !== editingId) as s}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-1.5">
        <label class="text-xs font-medium">Description</label>
        <input class="input" bind:value={newDescription} />
      </div>
    </div>

    {#if newType === 'dynamic'}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="space-y-1.5">
          <label class="text-xs font-medium">Tags (any of)</label>
          <input class="input" bind:value={newTags} placeholder="smoke, regression" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium">Components (any of)</label>
          <input class="input" bind:value={newComponents} placeholder="auth, payments" />
        </div>
        <div class="space-y-1.5">
          <label class="text-xs font-medium">Priorities (any of)</label>
          <input class="input" bind:value={newPriorities} placeholder="P0, P1" />
        </div>
      </div>
    {/if}

    {#if newType === 'static'}
      <div class="space-y-2">
        <label class="text-xs font-medium">Test cases</label>

        {#if formCases.length > 0}
          <div class="border border-[var(--color-border)] rounded-md divide-y divide-[var(--color-border)]">
            {#each formCases as c (c.id)}
              <div class="flex items-center gap-2 px-3 py-1.5 text-xs">
                <span class="font-mono text-[var(--color-muted-foreground)] shrink-0">{c.code}</span>
                <span class="flex-1 truncate">{c.title}</span>
                <button class="text-[var(--color-muted-foreground)] hover:text-[var(--color-destructive)]" on:click={() => removeCaseFromForm(c.id)}>
                  <X size={12} />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <div class="relative">
          <div class="flex items-center gap-2 input px-2">
            <Search size={13} class="text-[var(--color-muted-foreground)] shrink-0" />
            <input
              class="flex-1 bg-transparent outline-none text-sm py-1"
              placeholder="Search cases to add…"
              bind:value={formSearchQ}
              on:input={onFormSearchInput}
            />
          </div>
          {#if formSearchResults.length > 0}
            <div class="absolute z-10 left-0 right-0 mt-1 card shadow-lg divide-y divide-[var(--color-border)] max-h-52 overflow-y-auto">
              {#each formSearchResults as r (r.id)}
                <button
                  class="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-muted)] flex gap-2 items-center"
                  on:click={() => addCaseToForm(r)}
                >
                  <span class="font-mono text-[var(--color-muted-foreground)] shrink-0">{r.code}</span>
                  <span class="truncate">{r.title}</span>
                </button>
              {/each}
            </div>
          {:else if formSearching}
            <p class="text-xs text-[var(--color-muted-foreground)] mt-1 pl-1">Searching…</p>
          {/if}
        </div>
      </div>
    {/if}

    <div class="flex justify-end">
      <button class="btn btn-primary" disabled={saving || !newName} on:click={saveSuite}>
        {saveLabel}
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if suites.length === 0}
  <div class="card p-12 text-center">
    <FolderTree size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)] mb-3">No suites yet.</div>
    <button class="btn btn-primary" on:click={openNewForm}>
      <Plus size={16} /> Create your first suite
    </button>
  </div>
{:else}
  <div class="card p-3" on:dragend={resetDnd}>
    {#each rootSuites as s}
      <SuiteNode
        suite={s}
        allSuites={suites}
        children={[]}
        bind:collapsed
        {dragId}
        {overInfo}
        editingId={editingId}
        on:toggle={(e) => toggle(e.detail.id)}
        on:run={(e) => startRun(e.detail.suite)}
        on:edit={(e) => startEdit(e.detail.suite)}
        on:remove={(e) => removeSuite(e.detail.suite)}
        on:dragstart={(e) => onDragStart(e.detail)}
        on:dragover={(e) => onDragOver(e.detail)}
        on:drop={(e) => onDrop(e.detail)}
        on:casechange={onCaseChange}
      />
    {/each}
  </div>
{/if}
