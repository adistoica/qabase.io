<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Environment } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { Plus, Pencil, Trash2, Check, X, Globe } from '@lucide/svelte';
  import { modal } from '$lib/modal-store';

  let environments: Environment[] = [];
  let loading = true;

  let showCreate = false;
  let editingId: string | null = null;

  const emptyForm = () => ({
    name: '', description: '', browser: '', os: '', build: '', tags: '', variables: '' as string,
  });
  let form = emptyForm();
  let varPairs: { k: string; v: string }[] = [];
  let saving = false;
  let error = '';

  async function load() {
    loading = true;
    environments = await api.get<Environment[]>('/environments');
    loading = false;
  }

  onMount(load);

  function startCreate() {
    editingId = null;
    form = emptyForm();
    varPairs = [];
    error = '';
    showCreate = true;
  }

  function startEdit(e: Environment) {
    showCreate = false;
    editingId = e.id;
    form = { name: e.name, description: e.description, browser: e.browser, os: e.os, build: e.build, tags: e.tags.join(', '), variables: '' };
    varPairs = Object.entries(e.variables).map(([k, v]) => ({ k, v }));
    error = '';
  }

  function cancelEdit() {
    editingId = null;
    showCreate = false;
    form = emptyForm();
    varPairs = [];
    error = '';
  }

  function addVar() { varPairs = [...varPairs, { k: '', v: '' }]; }
  function removeVar(i: number) { varPairs = varPairs.filter((_, j) => j !== i); }

  function buildPayload() {
    const variables: Record<string, string> = {};
    for (const { k, v } of varPairs) {
      if (k.trim()) variables[k.trim()] = v;
    }
    return {
      name: form.name.trim(),
      description: form.description,
      browser: form.browser,
      os: form.os,
      build: form.build,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      variables,
    };
  }

  async function save() {
    if (!form.name.trim()) { error = 'Name is required'; return; }
    saving = true;
    error = '';
    try {
      if (editingId) {
        const updated = await api.put<Environment>(`/environments/${editingId}`, buildPayload());
        environments = environments.map((e) => e.id === updated.id ? updated : e);
      } else {
        const created = await api.post<Environment>('/environments', buildPayload());
        environments = [...environments, created];
      }
      cancelEdit();
    } catch (e: any) {
      error = e?.detail ?? 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function remove(id: string) {
    if (!await modal.confirm('Delete environment', 'This environment will be permanently deleted.', { destructive: true })) return;
    await api.del(`/environments/${id}`);
    environments = environments.filter((e) => e.id !== id);
  }
</script>

<PageHeader title="Environments">
  <svelte:fragment slot="actions">
    <button class="btn btn-primary" on:click={startCreate}>
      <Plus size={16} /> New environment
    </button>
  </svelte:fragment>
</PageHeader>

<div class="p-4 space-y-4">
  {#if showCreate}
    <div class="card p-4 space-y-3 border-2 border-[var(--color-accent)]">
      <div class="font-medium text-sm">New environment</div>
      {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2">
          <label class="label">Name *</label>
          <input class="input w-full" bind:value={form.name} />
        </div>
        <div class="col-span-2">
          <label class="label">Description</label>
          <input class="input w-full" bind:value={form.description} />
        </div>
        <div>
          <label class="label">Browser</label>
          <input class="input w-full" placeholder="e.g. Chrome 120" bind:value={form.browser} />
        </div>
        <div>
          <label class="label">OS</label>
          <input class="input w-full" placeholder="e.g. Ubuntu 22.04" bind:value={form.os} />
        </div>
        <div>
          <label class="label">Build</label>
          <input class="input w-full" placeholder="e.g. v1.2.3" bind:value={form.build} />
        </div>
        <div>
          <label class="label">Tags</label>
          <input class="input w-full" placeholder="staging, ci" bind:value={form.tags} />
        </div>
      </div>
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="label mb-0">Variables</label>
          <button class="btn btn-ghost btn-sm" on:click={addVar}><Plus size={12} /> Add</button>
        </div>
        {#each varPairs as pair, i}
          <div class="flex gap-2 mb-1">
            <input class="input flex-1" placeholder="KEY" bind:value={pair.k} />
            <input class="input flex-1" placeholder="value" bind:value={pair.v} />
            <button class="btn btn-ghost btn-sm px-2" on:click={() => removeVar(i)}><X size={12} /></button>
          </div>
        {/each}
      </div>
      <div class="flex gap-2">
        <button class="btn btn-primary" on:click={save} disabled={saving}>
          <Check size={14} /> {saving ? 'Saving…' : 'Create'}
        </button>
        <button class="btn btn-ghost" on:click={cancelEdit}><X size={14} /> Cancel</button>
      </div>
    </div>
  {/if}

  {#if loading}
    <p class="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
  {:else if environments.length === 0}
    <div class="card p-8 text-center text-[var(--color-muted-foreground)]">
      <Globe size={32} class="mx-auto mb-2 opacity-30" />
      <p class="text-sm">No environments yet.</p>
      <p class="text-xs mt-1">Create named environment presets to use when starting test runs.</p>
    </div>
  {:else}
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each environments as env (env.id)}
        {#if editingId === env.id}
          <div class="card p-4 space-y-2 col-span-full border-2 border-[var(--color-accent)]">
            <div class="font-medium text-sm">Edit environment</div>
            {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
            <div class="grid grid-cols-2 gap-2">
              <div class="col-span-2">
                <label class="label">Name *</label>
                <input class="input w-full" bind:value={form.name} />
              </div>
              <div class="col-span-2">
                <label class="label">Description</label>
                <input class="input w-full" bind:value={form.description} />
              </div>
              <div>
                <label class="label">Browser</label>
                <input class="input w-full" bind:value={form.browser} />
              </div>
              <div>
                <label class="label">OS</label>
                <input class="input w-full" bind:value={form.os} />
              </div>
              <div>
                <label class="label">Build</label>
                <input class="input w-full" bind:value={form.build} />
              </div>
              <div>
                <label class="label">Tags</label>
                <input class="input w-full" bind:value={form.tags} />
              </div>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="label mb-0">Variables</label>
                <button class="btn btn-ghost btn-sm" on:click={addVar}><Plus size={12} /> Add</button>
              </div>
              {#each varPairs as pair, i}
                <div class="flex gap-2 mb-1">
                  <input class="input flex-1" placeholder="KEY" bind:value={pair.k} />
                  <input class="input flex-1" placeholder="value" bind:value={pair.v} />
                  <button class="btn btn-ghost btn-sm px-2" on:click={() => removeVar(i)}><X size={12} /></button>
                </div>
              {/each}
            </div>
            <div class="flex gap-2">
              <button class="btn btn-primary" on:click={save} disabled={saving}>
                <Check size={14} /> {saving ? 'Saving…' : 'Save'}
              </button>
              <button class="btn btn-ghost" on:click={cancelEdit}><X size={14} /> Cancel</button>
            </div>
          </div>
        {:else}
          <div class="card p-4 flex flex-col gap-2">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-semibold text-sm">{env.name}</div>
                {#if env.description}<div class="text-xs text-[var(--color-muted-foreground)]">{env.description}</div>{/if}
              </div>
              <div class="flex gap-1 shrink-0">
                <button class="btn btn-ghost btn-sm px-2" on:click={() => startEdit(env)}><Pencil size={13} /></button>
                <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" on:click={() => remove(env.id)}><Trash2 size={13} /></button>
              </div>
            </div>
            <div class="text-xs space-y-0.5 text-[var(--color-muted-foreground)]">
              {#if env.browser}<div><span class="font-medium text-[var(--color-foreground)]">Browser:</span> {env.browser}</div>{/if}
              {#if env.os}<div><span class="font-medium text-[var(--color-foreground)]">OS:</span> {env.os}</div>{/if}
              {#if env.build}<div><span class="font-medium text-[var(--color-foreground)]">Build:</span> {env.build}</div>{/if}
              {#if Object.keys(env.variables).length > 0}
                <div><span class="font-medium text-[var(--color-foreground)]">Variables:</span> {Object.keys(env.variables).length}</div>
              {/if}
            </div>
            {#if env.tags.length > 0}
              <div class="flex flex-wrap gap-1">
                {#each env.tags as t}<span class="badge text-[10px]">{t}</span>{/each}
              </div>
            {/if}
            <div class="text-[10px] text-[var(--color-muted-foreground)] mt-auto pt-1 border-t">
              Updated {formatDate(env.updated_at)}
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
