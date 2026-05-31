<script lang="ts">
  import { api } from '$lib/api';
  import { projects } from '$lib/project-store';
  import type { DashboardOverview, CoverageRow, FlakinessRow, ReleaseScorecard, Defect, Review, Milestone, Environment, Project } from '$lib/api';
  import { formatDate, formatPct, statusBadgeClass } from '$lib/format';
  import {
    Activity, AlertTriangle, FileText, PlayCircle, Flag,
    Bug, ShieldCheck, TrendingUp, Clock, CheckCircle2, XCircle,
    SlidersHorizontal, RotateCcw, ChevronDown,
  } from '@lucide/svelte';

  // ── Project selector ───────────────────────────────────────────────────────
  let selectedProjectId = '';

  function lsProjectKey() { return 'dashboard_selected_project'; }
  function loadSelectedProject(): string {
    try { return localStorage.getItem(lsProjectKey()) ?? ''; } catch { return ''; }
  }
  function saveSelectedProject(id: string) {
    try { localStorage.setItem(lsProjectKey(), id); } catch {}
  }

  // Init: restore last selected project, fall back to first available
  $: if ($projects.length && !selectedProjectId) {
    const saved = loadSelectedProject();
    selectedProjectId = $projects.find((p) => p.id === saved)?.id ?? $projects[0].id;
  }

  $: selectedProject = $projects.find((p) => p.id === selectedProjectId) ?? null;

  function pickProject(id: string) {
    selectedProjectId = id;
    saveSelectedProject(id);
    pickerOpen = false;
  }

  let pickerOpen = false;

  // ── Filters ────────────────────────────────────────────────────────────────
  type Filters = { days: number; milestoneId: string; environment: string };
  const FILTER_DEFAULTS: Filters = { days: 14, milestoneId: '', environment: '' };

  function filtersKey(pid: string) { return `dashboard_filters_${pid}`; }
  function defaultsKey(pid: string) { return `dashboard_defaults_${pid}`; }

  function loadFilters(pid: string): Filters {
    try {
      const projectDefaults = JSON.parse(localStorage.getItem(defaultsKey(pid)) ?? '{}');
      const userOverrides   = JSON.parse(localStorage.getItem(filtersKey(pid)) ?? '{}');
      return { ...FILTER_DEFAULTS, ...projectDefaults, ...userOverrides };
    } catch { return { ...FILTER_DEFAULTS }; }
  }
  function saveFilters(pid: string, f: Filters) {
    try { localStorage.setItem(filtersKey(pid), JSON.stringify(f)); } catch {}
  }

  let filters: Filters = FILTER_DEFAULTS;
  let filterMilestones: Milestone[] = [];
  let filterEnvironments: Environment[] = [];

  $: if (selectedProjectId) {
    filters = loadFilters(selectedProjectId);
    loadOptions();
  }

  async function loadOptions() {
    [filterMilestones, filterEnvironments] = await Promise.all([
      api.getForProject<Milestone[]>(selectedProjectId, '/milestones').catch(() => []),
      api.getForProject<Environment[]>(selectedProjectId, '/environments').catch(() => []),
    ]);
  }

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    filters = { ...filters, [key]: value };
    saveFilters(selectedProjectId, filters);
  }

  function resetFilters() {
    filters = { ...FILTER_DEFAULTS };
    saveFilters(selectedProjectId, filters);
  }

  $: isFiltered = filters.days !== FILTER_DEFAULTS.days || !!filters.milestoneId || !!filters.environment;

  function qs(): string {
    const p = new URLSearchParams({ days: String(filters.days) });
    if (filters.milestoneId) p.set('milestone_id', filters.milestoneId);
    if (filters.environment) p.set('environment', filters.environment);
    return `?${p}`;
  }

  // ── Dashboard data ─────────────────────────────────────────────────────────
  let overview: DashboardOverview | null = null;
  let coverage: CoverageRow[] = [];
  let flakiness: FlakinessRow[] = [];
  let topFailing: { test_case_id: string; title: string; code?: string; failures: number }[] = [];
  let release: ReleaseScorecard[] = [];
  let defects: Defect[] = [];
  let reviews: Review[] = [];
  let loading = false;

  async function loadDashboard() {
    if (!selectedProjectId) return;
    overview = null; coverage = []; flakiness = []; topFailing = []; release = []; defects = []; reviews = [];
    loading = true;
    try {
      const pid = selectedProjectId;
      const q = qs();
      [overview, coverage, flakiness, topFailing, release, defects, reviews] = await Promise.all([
        api.getForProject<DashboardOverview>(pid, `/dashboard/overview${q}`),
        api.getForProject<CoverageRow[]>(pid, `/dashboard/coverage${q}`),
        api.getForProject<FlakinessRow[]>(pid, `/dashboard/flakiness${q}`),
        api.getForProject<any[]>(pid, `/dashboard/top-failing${q}`),
        api.getForProject<ReleaseScorecard[]>(pid, `/dashboard/release-readiness${q}`),
        api.getForProject<Defect[]>(pid, '/defects').catch(() => []),
        api.getForProject<Review[]>(pid, '/reviews').catch(() => []),
      ]);
    } catch { /* gracefully ignore */ }
    finally { loading = false; }
  }

  $: selectedProjectId, filters, loadDashboard();

  // ── Derived stats ──────────────────────────────────────────────────────────
  $: lastPassRate = overview?.trend?.length
    ? overview.trend[overview.trend.length - 1].pass_rate
    : null;

  $: openDefects = defects.filter((d) => d.status === 'open' || d.status === 'in_progress').length;
  $: defectsBySeverity = (['critical', 'high', 'medium', 'low'] as const).map((s) => ({
    label: s,
    count: defects.filter((d) => (d.status === 'open' || d.status === 'in_progress') && d.severity === s).length,
  }));
  $: maxDefectCount   = Math.max(1, ...defectsBySeverity.map((d) => d.count));
  $: maxCoverageCount = Math.max(1, ...coverage.map((c) => c.count));

  $: pendingReviews  = reviews.filter((r) => r.status === 'pending').length;
  $: approvedReviews = reviews.filter((r) => r.status === 'approved').length;
  $: rejectedReviews = reviews.filter((r) => r.status === 'rejected').length;

  function passRateColor(r: number | null) {
    if (r === null) return 'text-[var(--color-muted-foreground)]';
    if (r >= 0.9)   return 'text-[var(--color-success,#16a34a)]';
    if (r >= 0.7)   return 'text-[var(--color-warning)]';
    return 'text-[var(--color-destructive)]';
  }

  const CHART_W = 560, CHART_H = 80;
  $: trendLine = buildLine(overview?.trend ?? []);
  $: trendArea = buildArea(overview?.trend ?? []);

  function buildLine(pts: { pass_rate: number }[]): string {
    if (pts.length < 2) return '';
    const max = Math.max(...pts.map((p) => p.pass_rate));
    const min = Math.min(...pts.map((p) => p.pass_rate));
    const span = max - min || 0.1;
    return pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * CHART_W;
      const y = CHART_H - ((p.pass_rate - min) / span) * CHART_H * 0.85 - CHART_H * 0.075;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  function buildArea(pts: { pass_rate: number }[]): string {
    if (pts.length < 2) return '';
    return `${buildLine(pts)} L${CHART_W},${CHART_H} L0,${CHART_H} Z`;
  }

  const severityColor: Record<string, string> = {
    critical: 'bg-[var(--color-destructive)]',
    high:     'bg-orange-500',
    medium:   'bg-[var(--color-warning)]',
    low:      'bg-[var(--color-muted-foreground)]',
  };
</script>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<div class="flex flex-wrap items-center gap-3 mb-6">
  <!-- Project picker -->
  <div class="relative" >
    <button
      type="button"
      class="flex items-center gap-2 h-9 px-3 rounded-md border bg-[var(--color-card)] text-sm font-medium hover:bg-[var(--color-muted)] transition-colors"
      on:click={() => (pickerOpen = !pickerOpen)}
    >
      {#if selectedProject}
        <span class="grid place-items-center w-5 h-5 rounded text-[10px] font-bold uppercase bg-[var(--color-info)]/15 text-[var(--color-info)] shrink-0">
          {selectedProject.code_prefix?.slice(0, 2) || '??'}
        </span>
        {selectedProject.name}
      {:else}
        Select a project…
      {/if}
      <ChevronDown size={14} class="text-[var(--color-muted-foreground)] ml-1" />
    </button>

    {#if pickerOpen}
      <div class="absolute left-0 top-full mt-1 w-56 card shadow-lg z-30 overflow-hidden py-1">
        {#each $projects as p}
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-[var(--color-muted)]
              {p.id === selectedProjectId ? 'bg-[var(--color-accent)] font-medium' : ''}"
            on:click={() => pickProject(p.id)}
          >
            <span class="grid place-items-center w-5 h-5 rounded text-[10px] font-bold uppercase bg-[var(--color-info)]/15 text-[var(--color-info)] shrink-0">
              {p.code_prefix?.slice(0, 2) || '??'}
            </span>
            {p.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="flex-1 min-w-0">
    <h1 class="text-xl font-semibold">Dashboard</h1>
    <p class="text-xs text-[var(--color-muted-foreground)] mt-0.5">Quality snapshot — independent of the active project</p>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap items-center gap-2">
    <span class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] shrink-0">
      <SlidersHorizontal size={13} /> Filters
    </span>

    <select
      class="input h-8 text-xs pr-7"
      value={filters.days}
      on:change={(e) => setFilter('days', Number((e.target as HTMLSelectElement).value))}
    >
      <option value={7}>Last 7 days</option>
      <option value={14}>Last 14 days</option>
      <option value={30}>Last 30 days</option>
      <option value={90}>Last 90 days</option>
    </select>

    {#if filterMilestones.length > 0}
      <select
        class="input h-8 text-xs pr-7"
        value={filters.milestoneId}
        on:change={(e) => setFilter('milestoneId', (e.target as HTMLSelectElement).value)}
      >
        <option value="">All milestones</option>
        {#each filterMilestones.filter((m) => m.status === 'open') as m}
          <option value={m.id}>{m.name}</option>
        {/each}
      </select>
    {/if}

    {#if filterEnvironments.length > 0}
      <select
        class="input h-8 text-xs pr-7"
        value={filters.environment}
        on:change={(e) => setFilter('environment', (e.target as HTMLSelectElement).value)}
      >
        <option value="">All environments</option>
        {#each filterEnvironments as e}
          <option value={e.name}>{e.name}</option>
        {/each}
      </select>
    {/if}

    {#if isFiltered}
      <button
        class="btn btn-ghost h-8 px-2 text-xs flex items-center gap-1 text-[var(--color-muted-foreground)]"
        on:click={resetFilters}
        title="Reset filters"
      >
        <RotateCcw size={12} /> Reset
      </button>
    {/if}
  </div>
</div>

{#if !selectedProjectId}
  <div class="card p-12 text-center text-sm text-[var(--color-muted-foreground)]">Select a project above to view its dashboard.</div>

{:else if loading}
  <div class="animate-pulse space-y-6">
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {#each Array(6) as _}<div class="card px-4 py-5"><div class="h-3 w-20 rounded bg-[var(--color-muted)] mb-3"></div><div class="h-7 w-12 rounded bg-[var(--color-muted)]"></div></div>{/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="card p-5 lg:col-span-2 h-52"></div>
      <div class="card p-5 h-52"></div>
    </div>
  </div>

{:else if overview}
  <!-- Stat cards -->
  <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><FileText size={12} /> Test cases</div>
      <div class="text-2xl font-semibold tabular-nums">{overview.total_cases}</div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">not archived</div>
    </div>
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><TrendingUp size={12} /> Pass rate</div>
      <div class="text-2xl font-semibold tabular-nums {passRateColor(lastPassRate)}">
        {lastPassRate !== null ? formatPct(lastPassRate) : '—'}
      </div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">last {filters.days} days</div>
    </div>
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><PlayCircle size={12} /> Total runs</div>
      <div class="text-2xl font-semibold tabular-nums">{overview.total_runs}</div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">{overview.active_runs} in progress</div>
    </div>
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><Bug size={12} /> Open defects</div>
      <div class="text-2xl font-semibold tabular-nums {openDefects > 0 ? 'text-[var(--color-destructive)]' : ''}">{openDefects}</div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">open + in progress</div>
    </div>
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><Clock size={12} /> Reviews</div>
      <div class="text-2xl font-semibold tabular-nums {pendingReviews > 0 ? 'text-[var(--color-warning)]' : ''}">{pendingReviews}</div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">pending approval</div>
    </div>
    <div class="card px-4 py-4">
      <div class="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] mb-2"><Flag size={12} /> Milestones</div>
      <div class="text-2xl font-semibold tabular-nums">{overview.open_milestones}</div>
      <div class="text-[10px] text-[var(--color-muted-foreground)] mt-1">active releases</div>
    </div>
  </div>

  <!-- Trend + Recent runs -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <div class="card p-5 lg:col-span-2">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold flex items-center gap-2 text-sm"><Activity size={15} /> Pass-rate trend</h2>
        <span class="text-xs text-[var(--color-muted-foreground)]">last {filters.days} days</span>
      </div>
      {#if overview.trend.length >= 2}
        <svg viewBox="0 0 {CHART_W} {CHART_H}" class="w-full h-24 text-[var(--color-info)]" preserveAspectRatio="none">
          <path d={trendArea} class="fill-[var(--color-info)]/10" />
          <path d={trendLine} fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <div class="grid text-[10px] mt-2 text-[var(--color-muted-foreground)]"
          style="grid-template-columns: repeat({Math.min(overview.trend.length, 7)}, 1fr)">
          {#each overview.trend.slice(-7) as t}
            <div class="text-center truncate">{t.date.slice(5)}<br />{formatPct(t.pass_rate)}</div>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-10 text-center">Run a few test suites to see the trend chart.</div>
      {/if}
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-3"><PlayCircle size={15} /> Recent runs</h2>
      <ul class="divide-y divide-[var(--color-border)]">
        {#each overview.recent_runs.slice(0, 6) as r}
          <li class="py-2.5">
            <a href={`/${selectedProject?.slug}/runs/${r.id}`} class="block hover:opacity-80 transition-opacity">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[13px] font-medium truncate">{r.name}</span>
                <span class={statusBadgeClass(r.status)}>{r.status}</span>
              </div>
              <div class="text-[11px] text-[var(--color-muted-foreground)] mt-0.5">
                {r.summary.passed}/{r.summary.total} passed · {formatDate(r.started_at)}
              </div>
            </a>
          </li>
        {:else}
          <li class="py-6 text-sm text-[var(--color-muted-foreground)] text-center">No runs yet.</li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- Release readiness + Defects -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-4"><Flag size={15} /> Release readiness</h2>
      {#if release.length}
        <div class="space-y-3">
          {#each release as r}
            <div>
              <div class="flex items-center justify-between mb-1">
                <a class="text-sm font-medium hover:underline" href={`/${selectedProject?.slug}/milestones`}>{r.name}</a>
                <span class="text-sm font-semibold {passRateColor(r.pass_rate)}">{formatPct(r.pass_rate)}</span>
              </div>
              <div class="w-full h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div class="h-2 rounded-full {r.pass_rate >= 0.9 ? 'bg-[var(--color-success,#16a34a)]' : r.pass_rate >= 0.7 ? 'bg-[var(--color-warning)]' : 'bg-[var(--color-destructive)]'}"
                  style="width: {(r.pass_rate * 100).toFixed(1)}%"></div>
              </div>
              <div class="flex gap-3 mt-1 text-[11px] text-[var(--color-muted-foreground)]">
                <span class="text-[var(--color-success,#16a34a)]">✓ {r.passed}</span>
                <span class="text-[var(--color-destructive)]">✗ {r.failed}</span>
                {#if r.blocked > 0}<span class="text-[var(--color-warning)]">⊘ {r.blocked}</span>{/if}
                <span class="ml-auto">{r.total} total</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4">No open milestones.</div>
      {/if}
    </div>

    <div class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="font-semibold flex items-center gap-2 text-sm"><Bug size={15} /> Open defects by severity</h2>
        {#if openDefects > 0}
          <a href={`/${selectedProject?.slug}/defects`} class="text-xs text-[var(--color-info)] hover:underline">View all</a>
        {/if}
      </div>
      {#if openDefects === 0}
        <div class="flex flex-col items-center py-6 gap-2 text-[var(--color-success,#16a34a)]">
          <ShieldCheck size={32} /><span class="text-sm font-medium">No open defects</span>
        </div>
      {:else}
        <div class="space-y-3">
          {#each defectsBySeverity as s}
            <div class="flex items-center gap-3">
              <span class="w-16 text-xs capitalize text-[var(--color-muted-foreground)]">{s.label}</span>
              <div class="flex-1 h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
                <div class="h-2 rounded-full {severityColor[s.label]}" style="width: {((s.count / maxDefectCount) * 100).toFixed(1)}%"></div>
              </div>
              <span class="w-6 text-right text-sm font-medium tabular-nums">{s.count}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Review pipeline + Top failing + Flakiest -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-4"><ShieldCheck size={15} /> Review pipeline</h2>
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm text-[var(--color-warning)]"><Clock size={14} /> Pending</div>
          <span class="text-sm font-semibold tabular-nums">{pendingReviews}</span>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm text-[var(--color-success,#16a34a)]"><CheckCircle2 size={14} /> Approved</div>
          <span class="text-sm font-semibold tabular-nums">{approvedReviews}</span>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-sm text-[var(--color-destructive)]"><XCircle size={14} /> Rejected</div>
          <span class="text-sm font-semibold tabular-nums">{rejectedReviews}</span>
        </div>
        {#if pendingReviews > 0}
          <a href={`/${selectedProject?.slug}/review`} class="block mt-2 btn btn-outline w-full text-center text-xs">
            Review {pendingReviews} pending case{pendingReviews === 1 ? '' : 's'}
          </a>
        {/if}
      </div>
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-4"><Bug size={15} /> Top failing tests</h2>
      {#if topFailing.length}
        <ul class="divide-y divide-[var(--color-border)]">
          {#each topFailing.slice(0, 5) as t}
            <li class="py-2 flex items-center justify-between gap-3">
              <div class="text-[13px] truncate min-w-0">
                {#if t.code}<span class="font-mono text-[11px] text-[var(--color-muted-foreground)]">{t.code} </span>{/if}{t.title}
              </div>
              <span class="badge badge-destructive shrink-0">{t.failures}✗</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4 text-center">No failures recently.</div>
      {/if}
    </div>

    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-4"><AlertTriangle size={15} /> Flakiest tests</h2>
      {#if flakiness.length}
        <ul class="divide-y divide-[var(--color-border)]">
          {#each flakiness.slice(0, 5) as f}
            <li class="py-2 flex items-center justify-between gap-3">
              <div class="text-[13px] truncate min-w-0">
                {#if f.code}<span class="font-mono text-[11px] text-[var(--color-muted-foreground)]">{f.code} </span>{/if}{f.title}
              </div>
              <span class="badge badge-warning shrink-0 text-[10px]">{f.passed}P·{f.failed}F</span>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="text-sm text-[var(--color-muted-foreground)] py-4 text-center">No flaky tests detected.</div>
      {/if}
    </div>
  </div>

  <!-- Coverage by component -->
  {#if coverage.length}
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 text-sm mb-4"><FileText size={15} /> Coverage by component</h2>
      <div class="space-y-2">
        {#each coverage as c}
          <div class="grid items-center gap-3" style="grid-template-columns: 10rem 1fr 3rem 2rem 2rem">
            <span class="text-[13px] truncate">{c.component}</span>
            <div class="h-2 rounded-full bg-[var(--color-muted)] overflow-hidden">
              <div class="h-2 rounded-full bg-[var(--color-info)]" style="width: {((c.count / maxCoverageCount) * 100).toFixed(1)}%"></div>
            </div>
            <span class="text-right text-[13px] tabular-nums">{c.count}</span>
            <span class="text-right text-[11px] tabular-nums text-[var(--color-destructive)]" title="P0">P0·{c.p0}</span>
            <span class="text-right text-[11px] tabular-nums text-[var(--color-warning)]" title="P1">P1·{c.p1}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

{:else}
  <div class="card p-12 text-center text-sm text-[var(--color-muted-foreground)]">
    Failed to load dashboard data. Check your connection and try again.
  </div>
{/if}
