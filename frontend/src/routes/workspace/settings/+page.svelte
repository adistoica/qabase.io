<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/toast-store';

  interface Team {
    id: string;
    name: string;
    slug: string;
  }

  let team: Team | null = null;
  let name = '';
  let slug = '';
  let saving = false;

  onMount(async () => {
    try {
      const teams = await api.get<Team[]>('/teams');
      if (teams.length > 0) {
        team = teams[0];
        name = team.name;
        slug = team.slug;
      }
    } catch {
      // ignore
    }
  });

  async function save() {
    if (!team) return;
    saving = true;
    try {
      await api.put(`/teams/${team.slug}`, { name, slug });
      team = { ...team, name, slug };
      toast.success('Settings saved.');
    } catch (e: unknown) {
      toast.error((e as { detail?: string })?.detail || 'Save failed.');
    } finally {
      saving = false;
    }
  }
</script>

<PageHeader title="Workspace Settings" subtitle="Manage your workspace name and configuration." />

{#if team}
  <div class="card p-6 max-w-lg space-y-4">
    <div>
      <label class="label" for="ws-name">Name</label>
      <input id="ws-name" class="input mt-1" bind:value={name} />
    </div>
    <div>
      <label class="label" for="ws-slug">Slug</label>
      <input id="ws-slug" class="input mt-1" bind:value={slug} />
    </div>
    <button class="btn btn-primary" on:click={save} disabled={saving}>
      {saving ? 'Saving…' : 'Save'}
    </button>
  </div>
{:else}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{/if}
