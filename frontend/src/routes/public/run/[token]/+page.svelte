<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { formatDate, formatPct, statusBadgeClass } from '$lib/format';
  import { Rocket } from '@lucide/svelte';

  let data: any = null;
  let error = '';

  onMount(async () => {
    try {
      const r = await fetch(`/api/public/run/${$page.params.token}`);
      if (!r.ok) throw new Error((await r.json()).detail || 'error');
      data = await r.json();
    } catch (e: any) {
      error = e?.message || 'failed to load';
    }
  });
</script>

<div class="max-w-4xl mx-auto p-8">
  <div class="flex items-center gap-2 mb-6">
    <Rocket size={20} class="text-[var(--color-info)]" />
    <span class="font-semibold tracking-tight">QABase.io</span>
    <span class="text-xs text-[var(--color-muted-foreground)] ml-1">public read-only</span>
  </div>

  {#if error}
    <div class="card p-8 text-center text-sm text-[var(--color-destructive)]">{error}</div>
  {:else if data}
    <h1 class="text-2xl font-semibold tracking-tight">{data.name}</h1>
    <div class="text-sm text-[var(--color-muted-foreground)] mt-1">
      Started {formatDate(data.started_at)} · status {data.status} · pass rate {formatPct(data.summary.pass_rate)}
    </div>
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 my-6 text-sm">
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Total</div><div class="font-semibold">{data.summary.total}</div></div>
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Passed</div><div class="font-semibold text-[var(--color-success)]">{data.summary.passed}</div></div>
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Failed</div><div class="font-semibold text-[var(--color-destructive)]">{data.summary.failed}</div></div>
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Blocked</div><div class="font-semibold text-[var(--color-warning)]">{data.summary.blocked}</div></div>
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Skipped</div><div class="font-semibold">{data.summary.skipped}</div></div>
      <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Pending</div><div class="font-semibold">{data.summary.pending}</div></div>
    </div>
    <div class="card">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
          <tr class="text-left"><th class="px-4 py-2">Code</th><th class="px-4 py-2">Title</th><th class="px-4 py-2">Status</th></tr>
        </thead>
        <tbody>
          {#each data.results as r}
            <tr class="border-t">
              <td class="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">{r.code}</td>
              <td class="px-4 py-3">{r.title}</td>
              <td class="px-4 py-3"><span class={statusBadgeClass(r.status)}>{r.status}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
  {/if}
</div>
