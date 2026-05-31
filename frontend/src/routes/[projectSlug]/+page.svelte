<script lang="ts">
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import type { DashboardOverview, CoverageRow, FlakinessRow, ReleaseScorecard } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import { formatDate, formatPct, statusBadgeClass } from '$lib/format';
  import { Activity, AlertTriangle, FileText, PlayCircle, Flag, Bug } from '@lucide/svelte';

  $: slug = $page.params.projectSlug;

  let overview: DashboardOverview | null = null;
  let coverage: CoverageRow[] = [];
  let flakiness: FlakinessRow[] = [];
  let topFailing: { test_case_id: string; title: string; code?: string; failures: number }[] = [];
  let release: ReleaseScorecard[] = [];

  async function loadDashboard() {
    overview = null;
    coverage = [];
    flakiness = [];
    topFailing = [];
    release = [];
    try {
      [overview, coverage, flakiness, topFailing, release] = await Promise.all([
        api.get<DashboardOverview>('/dashboard/overview'),
        api.get<CoverageRow[]>('/dashboard/coverage'),
        api.get<FlakinessRow[]>('/dashboard/flakiness'),
        api.get<any[]>('/dashboard/top-failing'),
        api.get<ReleaseScorecard[]>('/dashboard/release-readiness'),
      ]);
    } catch { /* gracefully ignore */ }
  }

  // Re-fetch whenever the project slug changes (covers initial load + project switching)
  $: slug, loadDashboard();

  $: trendPath = overview && overview.trend.length
    ? sparkline(overview.trend.map((t) => t.pass_rate))
    : '';

  function sparkline(values: number[]): string {
    if (values.length < 2) return '';
    const w = 280, h = 60;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pts.join(' L')}`;
  }
</script>

<PageHeader title="Dashboard" subtitle="Today's quality snapshot." />

{#if overview}
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <StatCard label="Active test cases" value={overview.total_cases} hint="not archived" />
    <StatCard label="Total runs" value={overview.total_runs} />
    <StatCard label="In progress" value={overview.active_runs} hint="runs not yet completed" />
    <StatCard label="Open milestones" value={overview.open_milestones} hint="active releases" />
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="card p-5 lg:col-span-2">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold flex items-center gap-2"><Activity size={16} /> Pass-rate trend</h2>
        <span class="text-xs text-[var(--color-muted-foreground)]">last 14 days</span>
      </div>
      {#if overview.trend.length >= 2}
        <svg viewBox="0 0 280 60" class="w-full h-20 text-[var(--color-info)]">
          <path d={trendPath} fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
        <div class="grid grid-cols-7 text-[10px] mt-2 text-[var(--color-muted-foreground)]">
          {#each overview.trend.slice(-7) as t}
            <div class="text-center truncate">{t.date.slice(5)} · {formatPct(t.pass_rate)}</div>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-6 text-center">
          Not enough data yet — run a few suites to see trends.
        </div>
      {/if}
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4"><PlayCircle size={16} /> Recent runs</h2>
      <ul class="divide-y">
        {#each overview.recent_runs as r}
          <li class="py-2.5">
            <a href={`/${slug}/runs/${r.id}`} class="block hover:opacity-90">
              <div class="flex items-center justify-between gap-3">
                <div class="text-sm font-medium truncate">{r.name}</div>
                <span class={statusBadgeClass(r.status)}>{r.status}</span>
              </div>
              <div class="text-xs text-[var(--color-muted-foreground)] mt-0.5">
                {formatDate(r.started_at)} · {r.summary.passed}/{r.summary.total} passed
              </div>
            </a>
          </li>
        {:else}
          <li class="py-4 text-sm text-[var(--color-muted-foreground)]">No runs yet.</li>
        {/each}
      </ul>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4"><Flag size={16} /> Release readiness</h2>
      {#if release.length}
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-[var(--color-muted-foreground)] uppercase">
            <th class="pb-2">Milestone</th><th class="pb-2 text-right">Pass</th><th class="pb-2 text-right">Fail</th><th class="pb-2 text-right">Block</th><th class="pb-2 text-right">%</th>
          </tr></thead>
          <tbody>
            {#each release as r}
              <tr class="border-t">
                <td class="py-2"><a class="hover:underline" href={`/${slug}/milestones`}>{r.name}</a></td>
                <td class="py-2 text-right tabular-nums text-[var(--color-success)]">{r.passed}</td>
                <td class="py-2 text-right tabular-nums text-[var(--color-destructive)]">{r.failed}</td>
                <td class="py-2 text-right tabular-nums text-[var(--color-warning)]">{r.blocked}</td>
                <td class="py-2 text-right tabular-nums">{formatPct(r.pass_rate)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4">No open milestones.</div>
      {/if}
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4"><Bug size={16} /> Top failing tests</h2>
      {#if topFailing.length}
        <ul class="divide-y">
          {#each topFailing as t}
            <li class="py-2.5 flex items-center justify-between gap-3">
              <div class="text-sm truncate">
                <span class="font-mono text-xs text-[var(--color-muted-foreground)]">{t.code || ''}</span>
                {t.title}
              </div>
              <span class="badge badge-destructive shrink-0">{t.failures} fails</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4">No failures recently.</div>
      {/if}
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4"><FileText size={16} /> Coverage by component</h2>
      {#if coverage.length}
        <table class="w-full text-sm">
          <thead><tr class="text-left text-xs text-[var(--color-muted-foreground)] uppercase">
            <th class="pb-2">Component</th><th class="pb-2 text-right">Cases</th><th class="pb-2 text-right">P0</th><th class="pb-2 text-right">P1</th>
          </tr></thead>
          <tbody>
            {#each coverage as c}
              <tr class="border-t">
                <td class="py-2">{c.component}</td>
                <td class="py-2 text-right tabular-nums">{c.count}</td>
                <td class="py-2 text-right tabular-nums">{c.p0}</td>
                <td class="py-2 text-right tabular-nums">{c.p1}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4">No cases yet.</div>
      {/if}
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4"><AlertTriangle size={16} /> Flakiest tests</h2>
      {#if flakiness.length}
        <ul class="divide-y">
          {#each flakiness as f}
            <li class="py-2.5 flex items-center justify-between gap-3">
              <div class="text-sm truncate">
                <span class="font-mono text-xs text-[var(--color-muted-foreground)]">{f.code || ''}</span>
                {f.title}
              </div>
              <span class="badge badge-warning shrink-0">{f.passed}P · {f.failed}F / {f.runs}</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4">No flaky tests detected.</div>
      {/if}
    </div>
  </div>
{:else}
  <!-- skeleton loader -->
  <div class="animate-pulse space-y-6">
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      {#each Array(4) as _}
        <div class="card px-4 py-5">
          <div class="h-3 w-24 rounded bg-[var(--color-muted)] mb-3"></div>
          <div class="h-8 w-12 rounded bg-[var(--color-muted)]"></div>
        </div>
      {/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="card p-5 lg:col-span-2 h-44">
        <div class="h-4 w-32 rounded bg-[var(--color-muted)] mb-4"></div>
        <div class="h-20 rounded bg-[var(--color-muted)]"></div>
      </div>
      <div class="card p-5 h-44">
        <div class="h-4 w-24 rounded bg-[var(--color-muted)] mb-4"></div>
        {#each Array(3) as _}
          <div class="py-3 border-b last:border-b-0">
            <div class="h-3 w-3/4 rounded bg-[var(--color-muted)] mb-1.5"></div>
            <div class="h-2.5 w-1/2 rounded bg-[var(--color-muted)]"></div>
          </div>
        {/each}
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="card p-5 h-40">
        <div class="h-4 w-28 rounded bg-[var(--color-muted)] mb-4"></div>
        <div class="space-y-2">
          {#each Array(3) as _}
            <div class="h-3 rounded bg-[var(--color-muted)]"></div>
          {/each}
        </div>
      </div>
      <div class="card p-5 h-40">
        <div class="h-4 w-28 rounded bg-[var(--color-muted)] mb-4"></div>
        <div class="space-y-2">
          {#each Array(3) as _}
            <div class="h-3 rounded bg-[var(--color-muted)]"></div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
