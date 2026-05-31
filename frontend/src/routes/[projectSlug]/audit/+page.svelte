<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { AuditEvent } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { History } from '@lucide/svelte';

  let events: AuditEvent[] = [];
  let loading = true;
  let filter = '';

  async function load() {
    loading = true;
    const q = filter ? `?action=${encodeURIComponent(filter)}` : '';
    try {
      events = await api.get<AuditEvent[]>(`/audit${q}`);
    } catch (e: any) {
      events = [];
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<PageHeader title="Audit log" subtitle="Append-only record of every meaningful action." />

<div class="card mb-4 p-3 flex items-center gap-2">
  <input class="input" placeholder="Filter by action (e.g. case.created)" bind:value={filter} on:keydown={(e) => e.key === 'Enter' && load()} />
  <button class="btn btn-outline" on:click={load}>Apply</button>
</div>

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if events.length === 0}
  <div class="card p-12 text-center">
    <History size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)]">No matching events.</div>
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
    <table class="w-full text-sm">
      <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
        <tr class="text-left">
          <th class="px-4 py-2">When</th>
          <th class="px-4 py-2">Action</th>
          <th class="px-4 py-2">Target</th>
          <th class="px-4 py-2">Payload</th>
        </tr>
      </thead>
      <tbody>
        {#each events as e}
          <tr class="border-t">
            <td class="px-4 py-2 text-[var(--color-muted-foreground)]">{formatDate(e.created_at)}</td>
            <td class="px-4 py-2 font-mono text-xs">{e.action}</td>
            <td class="px-4 py-2 text-xs">{e.target_kind} {e.target_id ? `· ${e.target_id.slice(-6)}` : ''}</td>
            <td class="px-4 py-2 text-xs font-mono text-[var(--color-muted-foreground)] truncate max-w-md">
              {JSON.stringify(e.payload)}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    </div>
  </div>
{/if}
