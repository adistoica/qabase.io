<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Team } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/toast-store';
  import { modal } from '$lib/modal-store';
  import { goto } from '$app/navigation';

  let teams: Team[] = [];
  let selected: Team | null = null;
  let loading = true;
  let saving = false;
  let creating = false;

  let editName = '';
  let editSlug = '';
  let newName = '';
  let newSlug = '';

  async function load() {
    loading = true;
    try {
      teams = await api.get<Team[]>('/teams');
      if (teams.length > 0 && !selected) select(teams[0]);
    } finally {
      loading = false;
    }
  }

  function select(t: Team) {
    selected = t;
    editName = t.name;
    editSlug = t.slug;
  }

  async function save() {
    if (!selected) return;
    saving = true;
    try {
      const updated = await api.patch<Team>(`/teams/${selected.slug}`, {
        name: editName,
        slug: editSlug
      }, { silent: true });
      teams = teams.map((t) => (t.id === updated.id ? { ...updated, my_role: t.my_role } : t));
      selected = { ...updated, my_role: selected.my_role };
      toast.success('Team settings saved.');
    } catch (e: any) {
      toast.error(e?.detail || 'Save failed');
    } finally {
      saving = false;
    }
  }

  async function createTeam() {
    if (!newName.trim() || !newSlug.trim()) return;
    creating = true;
    try {
      const team = await api.post<Team>('/teams', { name: newName.trim(), slug: newSlug.trim() }, { silent: true });
      teams = [...teams, team];
      select(team);
      newName = '';
      newSlug = '';
      toast.success('Team created.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to create team');
    } finally {
      creating = false;
    }
  }

  async function deleteTeam() {
    if (!selected) return;
    const confirmed = await modal.confirm(
      'Delete team',
      `Are you sure you want to delete "${selected.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      await api.del(`/teams/${selected.slug}`, { silent: true });
      teams = teams.filter((t) => t.id !== selected!.id);
      selected = teams[0] ?? null;
      if (selected) select(selected);
      toast.success('Team deleted.');
    } catch (e: any) {
      toast.error(e?.detail || 'Delete failed');
    }
  }

  function slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  onMount(load);
</script>

<PageHeader title="Team Settings" subtitle="Manage your teams and their settings." />

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else}
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Team list -->
    <div class="card p-4 space-y-2">
      <h2 class="font-semibold text-sm mb-3">Your teams</h2>
      {#each teams as t}
        <button
          type="button"
          on:click={() => select(t)}
          class="w-full text-left px-3 py-2 rounded-md text-sm transition-colors
            {selected?.id === t.id
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium'
              : 'hover:bg-[var(--color-muted)]'}"
        >
          <div class="font-medium">{t.name}</div>
          <div class="text-xs text-[var(--color-muted-foreground)]">{t.slug} · {t.my_role}</div>
        </button>
      {/each}

      <hr class="border-[var(--color-border)] my-2" />
      <div class="space-y-2">
        <h3 class="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wide">Create team</h3>
        <input
          class="input"
          placeholder="Team name"
          bind:value={newName}
          on:input={() => { if (!newSlug) newSlug = slugify(newName); }}
        />
        <input class="input" placeholder="slug" bind:value={newSlug} />
        <button
          class="btn btn-primary w-full"
          disabled={creating || !newName.trim() || !newSlug.trim()}
          on:click={createTeam}
        >
          {creating ? 'Creating…' : 'Create team'}
        </button>
      </div>
    </div>

    <!-- Team detail -->
    {#if selected}
      <div class="lg:col-span-2 space-y-4">
        <div class="card p-5">
          <h2 class="font-semibold mb-4">Team profile</h2>
          <div class="space-y-3">
            <div>
              <label class="text-xs font-medium">Name</label>
              <input
                class="input mt-1"
                bind:value={editName}
                disabled={selected.my_role === 'member' || selected.my_role === 'viewer'}
              />
            </div>
            <div>
              <label class="text-xs font-medium">Slug</label>
              <input
                class="input mt-1"
                bind:value={editSlug}
                disabled={selected.my_role === 'member' || selected.my_role === 'viewer'}
              />
            </div>
            <div>
              <label class="text-xs font-medium">Your role</label>
              <div class="mt-1 text-sm capitalize">{selected.my_role}</div>
            </div>
          </div>
          {#if selected.my_role === 'owner' || selected.my_role === 'admin'}
            <div class="mt-4 flex justify-end">
              <button class="btn btn-primary" disabled={saving} on:click={save}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          {/if}
        </div>

        {#if selected.my_role === 'owner'}
          <div class="card p-5 border-red-500/30 bg-red-500/5">
            <h2 class="font-semibold text-red-600 dark:text-red-400 mb-3">Danger zone</h2>
            <p class="text-sm text-[var(--color-muted-foreground)] mb-4">
              Deleting a team is permanent and cannot be undone.
            </p>
            <button class="btn bg-red-600 hover:bg-red-700 text-white" on:click={deleteTeam}>
              Delete team
            </button>
          </div>
        {/if}
      </div>
    {:else}
      <div class="lg:col-span-2 text-sm text-[var(--color-muted-foreground)]">
        Select or create a team to get started.
      </div>
    {/if}
  </div>
{/if}
