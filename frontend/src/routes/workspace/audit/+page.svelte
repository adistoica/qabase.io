<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { History } from '@lucide/svelte';

  interface AuditEvent {
    id: string;
    actor_id: string | null;
    project_id: string | null;
    action: string;
    target_kind: string;
    target_id: string | null;
    payload: Record<string, unknown>;
    ip?: string;
    created_at: string;
  }

  let events: AuditEvent[] = [];
  let loading = true;
  let actionFilter = '';
  let projectFilter = '';

  async function load() {
    loading = true;
    const params = new URLSearchParams();
    if (actionFilter) params.set('action', actionFilter);
    if (projectFilter) params.set('project_id', projectFilter);
    const q = params.size ? `?${params}` : '';
    try {
      events = await api.get<AuditEvent[]>(`/workspace/audit${q}`);
    } catch {
      events = [];
    } finally {
      loading = false;
    }
  }

  onMount(load);
</script>

<PageHeader title="Audit log" subtitle="Append-only record of every meaningful action across the platform." />

<div class="card mb-4 p-3 flex flex-wrap items-center gap-2">
  <input
    class="input flex-1 min-w-[160px]"
    placeholder="Filter by action (e.g. case.created)"
    bind:value={actionFilter}
    on:keydown={(e) => e.key === 'Enter' && load()}
  />
  <input
    class="input w-64"
    placeholder="Filter by project ID"
    bind:value={projectFilter}
    on:keydown={(e) => e.key === 'Enter' && load()}
  />
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
            <th class="px-4 py-2">Project</th>
            <th class="px-4 py-2">Target</th>
            <th class="px-4 py-2">Payload</th>
          </tr>
        </thead>
        <tbody>
          {#each events as e}
            <tr class="border-t">
              <td class="px-4 py-2 text-[var(--color-muted-foreground)]">{formatDate(e.created_at)}</td>
              <td class="px-4 py-2 font-mono text-xs">{e.action}</td>
              <td class="px-4 py-2 text-xs text-[var(--color-muted-foreground)]">{e.project_id ? e.project_id.slice(-8) : '—'}</td>
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
