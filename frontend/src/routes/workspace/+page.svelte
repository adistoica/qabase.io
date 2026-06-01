<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import { projects } from '$lib/project-store';

  interface Overview {
    total_projects: number;
    total_users: number;
    runs_last_30d: number;
  }

  let overview: Overview | null = null;

  onMount(async () => {
    try {
      overview = await api.get<Overview>('/workspace/overview');
    } catch {
      // non-admins fall back to local data
    }
  });
</script>

<PageHeader title="Workspace" subtitle="Overview of your organisation's activity." />

<div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <StatCard label="Projects"    value={overview?.total_projects ?? $projects.length} />
  <StatCard label="Members"     value={overview?.total_users    ?? '—'} />
  <StatCard label="Runs (30d)"  value={overview?.runs_last_30d  ?? '—'} />
</div>
