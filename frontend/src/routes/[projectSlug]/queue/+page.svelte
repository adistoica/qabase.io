<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { QueueItem } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { Inbox } from '@lucide/svelte';
  import { page } from '$app/stores';

  $: slug = $page.params.projectSlug;

  let items: QueueItem[] = [];
  let loading = true;

  onMount(async () => {
    items = await api.get<QueueItem[]>('/runs/my-queue');
    loading = false;
  });
</script>

<PageHeader title="My queue" subtitle="Run-results assigned to you and still open." />

{#if loading}
  <div class="card animate-pulse">
    <div class="table-wrap">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
          <tr class="text-left">
            <th class="px-4 py-2">Run</th>
            <th class="px-4 py-2">Case</th>
            <th class="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each Array(4) as _}
            <tr class="border-t">
              <td class="px-4 py-3"><div class="h-3 w-40 rounded bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-3"><div class="h-3 w-56 rounded bg-[var(--color-muted)]"></div></td>
              <td class="px-4 py-3"><div class="h-5 w-16 rounded-full bg-[var(--color-muted)]"></div></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{:else if items.length === 0}
  <div class="card p-12 text-center">
    <Inbox size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)]">Inbox zero — nothing pending.</div>
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
    <table class="w-full text-sm">
      <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
        <tr class="text-left">
          <th class="px-4 py-2">Run</th>
          <th class="px-4 py-2">Case</th>
          <th class="px-4 py-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {#each items as it}
          <tr class="border-t table-row-hover">
            <td class="px-4 py-3">
              <a href={`/${slug}/runs/${it.run_id}`} class="hover:underline">{it.run_name}</a>
            </td>
            <td class="px-4 py-3">
              <span class="font-mono text-xs text-[var(--color-muted-foreground)]">{it.code || ''}</span>
              {it.title}
            </td>
            <td class="px-4 py-3">
              <span class="badge">{it.status}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </div>
{/if}
