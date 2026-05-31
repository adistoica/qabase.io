<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import type { Project } from '$lib/api';
  import { projects as projectsStore } from '$lib/project-store';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Plus, Pencil, Trash2, Check, X, FolderKanban } from '@lucide/svelte';
  import { modal } from '$lib/modal-store';
  import { toast } from '$lib/toast-store';

  let list: Project[] = [];
  let loading = true;

  // create form
  let showCreate = false;
  let createForm = { name: '', slug: '', code_prefix: '', description: '' };
  let creating = false;
  let createError = '';

  // rename state: project id → draft name/description
  let editing: Record<string, { name: string; description: string }> = {};
  let saving: Record<string, boolean> = {};

  // delete busy
  let deleting: Record<string, boolean> = {};

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function prefixify(s: string) {
    return s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'TP';
  }

  $: if (!createForm.slug && createForm.name) {
    createForm.slug = slugify(createForm.name);
    createForm.code_prefix = prefixify(createForm.name);
  }

  async function load() {
    loading = true;
    list = await api.get<Project[]>('/projects');
    projectsStore.set(list);
    loading = false;
  }

  onMount(load);

  async function create() {
    createError = '';
    if (!createForm.name.trim()) { createError = 'Name is required'; return; }
    if (!createForm.slug.trim()) { createError = 'Slug is required'; return; }
    if (!createForm.code_prefix.trim()) { createError = 'Code prefix is required'; return; }
    creating = true;
    try {
      const p = await api.post<Project>('/projects', {
        name: createForm.name.trim(),
        slug: createForm.slug.trim(),
        code_prefix: prefixify(createForm.code_prefix),
        description: createForm.description.trim(),
      });
      await load();
      showCreate = false;
      createForm = { name: '', slug: '', code_prefix: '', description: '' };
      await goto(`/${p.slug}/`);
    } catch (e: any) {
      createError = e?.detail ?? 'Failed to create project';
    } finally {
      creating = false;
    }
  }

  function startEdit(p: Project) {
    editing = { ...editing, [p.id]: { name: p.name, description: p.description } };
  }

  function cancelEdit(id: string) {
    const next = { ...editing };
    delete next[id];
    editing = next;
  }

  async function saveEdit(p: Project) {
    const draft = editing[p.id];
    if (!draft) return;
    saving = { ...saving, [p.id]: true };
    try {
      await api.put(`/projects/${p.id}`, {
        name: draft.name.trim() || p.name,
        description: draft.description,
      });
      cancelEdit(p.id);
      await load();
    } catch (e: any) {
      toast.error(e?.detail ?? 'Failed to save');
    } finally {
      const s = { ...saving };
      delete s[p.id];
      saving = s;
    }
  }

  async function remove(p: Project) {
    if (!await modal.confirm(
      `Delete "${p.name}"?`,
      'This permanently deletes ALL test cases, runs, suites, defects, and other data for this project. This cannot be undone.',
      { destructive: true, confirmLabel: 'Delete project' }
    )) return;
    deleting = { ...deleting, [p.id]: true };
    try {
      await api.del(`/projects/${p.id}`);
      await load();
    } catch (e: any) {
      toast.error(e?.detail ?? 'Failed to delete project');
    } finally {
      const d = { ...deleting };
      delete d[p.id];
      deleting = d;
    }
  }
</script>

<PageHeader title="Projects" subtitle="Manage all your testing projects.">
  <svelte:fragment slot="actions">
    <button class="btn btn-primary" on:click={() => (showCreate = !showCreate)}>
      <Plus size={16} /> New project
    </button>
  </svelte:fragment>
</PageHeader>

<!-- Create form -->
{#if showCreate}
  <div class="card p-5 mb-6 border-2 border-[var(--color-accent)] space-y-4">
    <h2 class="font-semibold text-sm">New project</h2>
    {#if createError}
      <p class="text-xs text-[var(--color-destructive)]">{createError}</p>
    {/if}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="label">Name *</label>
        <input
          class="input w-full"
          placeholder="My Project"
          bind:value={createForm.name}
          on:input={() => {
            createForm.slug = slugify(createForm.name);
            createForm.code_prefix = prefixify(createForm.name);
          }}
        />
      </div>
      <div>
        <label class="label">Code prefix * <span class="text-[var(--color-muted-foreground)] font-normal">(used in test IDs)</span></label>
        <input
          class="input w-full font-mono uppercase"
          placeholder="MP"
          maxlength="4"
          bind:value={createForm.code_prefix}
          on:input={() => { createForm.code_prefix = createForm.code_prefix.toUpperCase().replace(/[^A-Z0-9]/g, ''); }}
        />
      </div>
      <div>
        <label class="label">URL slug * <span class="text-[var(--color-muted-foreground)] font-normal">(used in URLs, immutable)</span></label>
        <input
          class="input w-full font-mono"
          placeholder="my-project"
          bind:value={createForm.slug}
          on:input={() => { createForm.slug = slugify(createForm.slug + ' ').trimEnd(); }}
        />
        <p class="text-[10px] text-[var(--color-muted-foreground)] mt-1">
          Will appear as <code class="font-mono">/{createForm.slug || 'my-project'}/cases</code>
        </p>
      </div>
      <div>
        <label class="label">Description</label>
        <input class="input w-full" placeholder="Optional description" bind:value={createForm.description} />
      </div>
    </div>
    <div class="flex gap-2">
      <button class="btn btn-primary" on:click={create} disabled={creating}>
        <Check size={14} /> {creating ? 'Creating…' : 'Create project'}
      </button>
      <button class="btn btn-ghost" on:click={() => { showCreate = false; createError = ''; }}>
        <X size={14} /> Cancel
      </button>
    </div>
  </div>
{/if}

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if list.length === 0}
  <div class="card p-12 text-center">
    <FolderKanban size={32} class="mx-auto mb-3 text-[var(--color-muted-foreground)] opacity-40" />
    <p class="text-sm text-[var(--color-muted-foreground)] mb-4">No projects yet.</p>
    <button class="btn btn-primary" on:click={() => (showCreate = true)}>
      <Plus size={16} /> Create your first project
    </button>
  </div>
{:else}
  <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
    {#each list as p (p.id)}
      <div class="card p-5 flex flex-col gap-3">
        <!-- Header row -->
        <div class="flex items-start gap-3">
          <span class="grid place-items-center w-9 h-9 rounded-lg bg-[var(--color-info)]/15 text-[var(--color-info)] text-sm font-bold uppercase shrink-0">
            {p.code_prefix?.slice(0, 2) || 'TP'}
          </span>
          <div class="flex-1 min-w-0">
            {#if editing[p.id]}
              <input
                class="input w-full h-8 text-sm font-semibold mb-1"
                bind:value={editing[p.id].name}
                on:keydown={(e) => e.key === 'Enter' && saveEdit(p)}
              />
              <textarea
                class="input w-full text-xs resize-none h-16"
                placeholder="Description"
                bind:value={editing[p.id].description}
              ></textarea>
            {:else}
              <div class="font-semibold text-sm truncate">{p.name}</div>
              {#if p.description}
                <p class="text-xs text-[var(--color-muted-foreground)] mt-0.5 line-clamp-2">{p.description}</p>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Meta -->
        <div class="flex flex-wrap gap-1.5 text-[11px]">
          <span class="badge font-mono">{p.slug}</span>
          <span class="badge">{p.code_prefix}-###</span>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2 pt-1 border-t">
          {#if editing[p.id]}
            <button
              class="btn btn-primary btn-sm flex-1"
              on:click={() => saveEdit(p)}
              disabled={saving[p.id]}
            >
              <Check size={13} /> {saving[p.id] ? 'Saving…' : 'Save'}
            </button>
            <button class="btn btn-ghost btn-sm" on:click={() => cancelEdit(p.id)}>
              <X size={13} /> Cancel
            </button>
          {:else}
            <a href={`/${p.slug}/repository`} class="btn btn-outline btn-sm flex-1 justify-center">
              Open
            </a>
            <button class="btn btn-ghost btn-sm px-2" title="Rename" on:click={() => startEdit(p)}>
              <Pencil size={13} />
            </button>
            <button
              class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]"
              title="Delete"
              on:click={() => remove(p)}
              disabled={deleting[p.id] || list.length <= 1}
            >
              <Trash2 size={13} />
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/if}
