<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Step } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { Plus, Search, Pencil, Trash2, Tag, Check, X } from '@lucide/svelte';
  import { modal } from '$lib/modal-store';

  let steps: Step[] = [];
  let loading = true;
  let query = '';

  let showCreate = false;
  let editingId: string | null = null;

  const emptyForm = () => ({ title: '', body_md: '', expected_md: '', tags: '' });
  let form = emptyForm();
  let saving = false;
  let error = '';

  async function load() {
    loading = true;
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    steps = await api.get<Step[]>(`/steps${qs}`);
    loading = false;
  }

  onMount(load);

  function startCreate() {
    editingId = null;
    form = emptyForm();
    error = '';
    showCreate = true;
  }

  function startEdit(s: Step) {
    showCreate = false;
    editingId = s.id;
    form = { title: s.title, body_md: s.body_md, expected_md: s.expected_md, tags: s.tags.join(', ') };
    error = '';
  }

  function cancelEdit() {
    editingId = null;
    showCreate = false;
    form = emptyForm();
    error = '';
  }

  async function save() {
    if (!form.title.trim()) { error = 'Title is required'; return; }
    saving = true;
    error = '';
    const payload = {
      title: form.title.trim(),
      body_md: form.body_md,
      expected_md: form.expected_md,
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      if (editingId) {
        await api.put(`/steps/${editingId}`, payload);
      } else {
        await api.post('/steps', payload);
      }
      cancelEdit();
      await load();
    } catch (e: any) {
      error = e?.detail ?? 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function remove(id: string) {
    if (!await modal.confirm('Delete step', 'This shared step will be permanently deleted and unlinked from any test cases.', { destructive: true })) return;
    await api.del(`/steps/${id}`);
    await load();
  }

  let searchTimeout: ReturnType<typeof setTimeout>;
  function onSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(load, 300);
  }
</script>

<PageHeader title="Shared Steps">
  <svelte:fragment slot="actions">
    <button class="btn btn-primary" on:click={startCreate}>
      <Plus size={16} /> New step
    </button>
  </svelte:fragment>
</PageHeader>

<div class="p-4 space-y-4">
  <!-- Search -->
  <div class="relative max-w-sm">
    <Search size={15} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
    <input
      class="input pl-8 w-full"
      placeholder="Search steps…"
      bind:value={query}
      on:input={onSearch}
    />
  </div>

  <!-- Create form -->
  {#if showCreate}
    <div class="card p-4 space-y-3 border-2 border-[var(--color-accent)]">
      <div class="font-medium text-sm">New shared step</div>
      {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
      <input class="input w-full" placeholder="Title *" bind:value={form.title} />
      <textarea class="input w-full h-24 resize-y font-mono text-xs" placeholder="Step body (markdown)" bind:value={form.body_md}></textarea>
      <textarea class="input w-full h-20 resize-y font-mono text-xs" placeholder="Expected result (markdown)" bind:value={form.expected_md}></textarea>
      <input class="input w-full" placeholder="Tags (comma-separated)" bind:value={form.tags} />
      <div class="flex gap-2">
        <button class="btn btn-primary" on:click={save} disabled={saving}>
          <Check size={14} /> {saving ? 'Saving…' : 'Create'}
        </button>
        <button class="btn btn-ghost" on:click={cancelEdit}>
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Table -->
  {#if loading}
    <p class="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
  {:else if steps.length === 0}
    <div class="card p-8 text-center text-[var(--color-muted-foreground)]">
      <p class="text-sm">No shared steps yet.</p>
      <p class="text-xs mt-1">Create reusable steps to reference them across test cases.</p>
    </div>
  {:else}
    <div class="card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">
            <th class="text-left px-4 py-2 font-medium">Title</th>
            <th class="text-left px-4 py-2 font-medium">Tags</th>
            <th class="text-left px-4 py-2 font-medium">Used by</th>
            <th class="text-left px-4 py-2 font-medium">Updated</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {#each steps as s (s.id)}
            <tr class="border-b last:border-0 hover:bg-[var(--color-muted)]/40">
              {#if editingId === s.id}
                <td colspan="5" class="px-4 py-3">
                  <div class="space-y-2">
                    {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
                    <input class="input w-full" placeholder="Title *" bind:value={form.title} />
                    <textarea class="input w-full h-20 resize-y font-mono text-xs" placeholder="Step body" bind:value={form.body_md}></textarea>
                    <textarea class="input w-full h-16 resize-y font-mono text-xs" placeholder="Expected result" bind:value={form.expected_md}></textarea>
                    <input class="input w-full" placeholder="Tags (comma-separated)" bind:value={form.tags} />
                    <div class="flex gap-2">
                      <button class="btn btn-primary btn-sm" on:click={save} disabled={saving}>
                        <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button class="btn btn-ghost btn-sm" on:click={cancelEdit}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                </td>
              {:else}
                <td class="px-4 py-2.5 font-medium">{s.title}</td>
                <td class="px-4 py-2.5">
                  <div class="flex flex-wrap gap-1">
                    {#each s.tags as t}
                      <span class="badge"><Tag size={10} class="mr-0.5" />{t}</span>
                    {/each}
                  </div>
                </td>
                <td class="px-4 py-2.5 text-[var(--color-muted-foreground)]">{s.used_by_count}</td>
                <td class="px-4 py-2.5 text-[var(--color-muted-foreground)] text-xs">{formatDate(s.updated_at)}</td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-1 justify-end">
                    <button class="btn btn-ghost btn-sm px-2" on:click={() => startEdit(s)} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" on:click={() => remove(s.id)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
