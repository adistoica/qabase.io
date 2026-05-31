<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Run } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate, formatPct, statusBadgeClass } from '$lib/format';
  import { PlayCircle } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  $: slug = $page.params.projectSlug;

  let runs: Run[] = [];
  let loading = true;

  onMount(async () => {
    runs = await api.get<Run[]>('/runs');
    loading = false;
  });
</script>

<PageHeader title="Runs" subtitle="Every test execution, past and present." />

{#if loading}
  <div class="card animate-pulse">
    <div class="table-wrap">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
          <tr class="text-left">
            <th class="px-4 py-2">Run</th>
            <th class="px-4 py-2">Status</th>
            <th class="px-4 py-2 text-right">Pass rate</th>
            <th class="px-4 py-2 text-right">Cases</th>
            <th class="px-4 py-2 hidden md:table-cell">Started</th>
          </tr>
        </thead>
        <tbody>
          {#each Array(5) as _}
            <tr class="border-t">
              <td class="px-4 py-3"><div class="h-3 w-48 rounded bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-3"><div class="h-5 w-16 rounded-full bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-3 text-right"><div class="h-3 w-10 rounded bg-[var(--color-muted)] ml-auto"></div></td>
              <td class="px-4 py-3 text-right"><div class="h-3 w-16 rounded bg-[var(--color-muted)] ml-auto"></div></td>
              <td class="px-4 py-3 hidden md:table-cell"><div class="h-3 w-32 rounded bg-[var(--color-muted)]"></div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{:else if runs.length === 0}
  <div class="card p-12 text-center">
    <PlayCircle size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)] mb-3">
      No runs yet. Start one from a suite.
    </div>
    <a href={`/${slug}/repository`} class="btn btn-primary inline-flex">Go to repository</a>
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
    <table class="w-full text-sm">
      <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
        <tr class="text-left">
          <th class="px-4 py-2">Run</th>
          <th class="px-4 py-2">Status</th>
          <th class="px-4 py-2 text-right">Pass rate</th>
          <th class="px-4 py-2 text-right">Cases</th>
          <th class="px-4 py-2 hidden md:table-cell">Started</th>
        </tr>
      </thead>
      <tbody>
        {#each runs as r}
          <tr
            class="border-t table-row-hover cursor-pointer"
            on:click={() => goto(`/${slug}/runs/${r.id}`)}
          >
            <td class="px-4 py-3 font-medium">{r.name}</td>
            <td class="px-4 py-3">
              <span class={statusBadgeClass(r.status)}>{r.status}</span>
            </td>
            <td class="px-4 py-3 text-right tabular-nums">{formatPct(r.summary.pass_rate)}</td>
            <td class="px-4 py-3 text-right tabular-nums">
              <span class="text-[var(--color-success)]">{r.summary.passed}</span>
              ·
              <span class="text-[var(--color-destructive)]">{r.summary.failed}</span>
              / {r.summary.total}
            </td>
            <td class="px-4 py-3 hidden md:table-cell text-[var(--color-muted-foreground)]">
              {formatDate(r.started_at)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </div>
{/if}
