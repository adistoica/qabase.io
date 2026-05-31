<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { api } from '$lib/api';
  import { currentUser } from '$lib/auth-store';
  import StatCard from '$lib/components/StatCard.svelte';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { Users, Building2, Activity, Zap, FolderOpen, Bug, FlaskConical } from '@lucide/svelte';

  interface AdminOverview {
    total_users: number; total_teams: number; total_projects: number;
    total_cases: number; open_defects: number;
    runs_last_30d: number; runs_in_progress: number;
    new_users_7d: number; active_users_7d: number;
    activity_trend: { date: string; count: number }[];
    signup_trend:   { date: string; count: number }[];
  }
  interface AdminUser {
    id: string; email: string; display_name: string; roles: string[];
    is_active: boolean; created_at: string;
    team_count: number; events_30d: number; last_seen: string | null;
  }
  interface AdminActivity {
    id: string; action: string; created_at: string;
    actor_email: string | null; actor_name: string | null; project_id: string | null;
  }
  interface AdminTeam {
    id: string; name: string; slug: string;
    owner_email: string | null; owner_name: string | null;
    member_count: number; created_at: string;
  }
  interface AdminProject {
    id: string; name: string; slug: string; created_at: string;
    case_count: number; runs_30d: number; open_defects: number;
    last_run_at: string | null;
  }

  let overview: AdminOverview | null = null;
  let users: AdminUser[] = [];
  let activity: AdminActivity[] = [];
  let teams: AdminTeam[] = [];
  let projects: AdminProject[] = [];
  let loading = true;

  // User table sort
  let sortKey: keyof AdminUser = 'events_30d';
  let sortDir: 'asc' | 'desc' = 'desc';
  $: sortedUsers = [...users].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });
  function setSort(key: keyof AdminUser) {
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'desc'; }
  }
  function sortIcon(key: keyof AdminUser) {
    return sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
  }

  function sparkline(values: number[]): string {
    if (values.length < 2) return '';
    const w = 280, h = 52;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M${pts.join(' L')}`;
  }

  $: activityPath = overview ? sparkline(overview.activity_trend.map((t) => t.count)) : '';
  $: signupPath   = overview ? sparkline(overview.signup_trend.map((t) => t.count))   : '';

  onMount(async () => {
    if (!$currentUser?.roles?.includes('superadmin')) { await goto('/'); return; }
    try {
      [overview, users, activity, teams, projects] = await Promise.all([
        api.get<AdminOverview>('/admin/overview'),
        api.get<AdminUser[]>('/admin/users'),
        api.get<AdminActivity[]>('/admin/activity'),
        api.get<AdminTeam[]>('/admin/teams'),
        api.get<AdminProject[]>('/admin/projects'),
      ]);
    } catch { /* api.ts shows error toasts */ }
    finally { loading = false; }
  });
</script>

<PageHeader title="Superadmin" subtitle="Platform-wide health overview." />

{#if loading}
  <div class="animate-pulse space-y-6">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
      {#each Array(5) as _}<div class="card p-5 h-20 bg-[var(--color-muted)]"></div>{/each}
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      {#each Array(4) as _}<div class="card p-5 h-20 bg-[var(--color-muted)]"></div>{/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="card p-5 lg:col-span-2 h-44 bg-[var(--color-muted)]"></div>
      <div class="card p-5 h-44 bg-[var(--color-muted)]"></div>
    </div>
    <div class="card p-5 h-48 bg-[var(--color-muted)]"></div>
    <div class="card p-5 h-48 bg-[var(--color-muted)]"></div>
  </div>

{:else if overview}

  <!-- Row 1: platform scale -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
    <StatCard label="Users"           value={overview.total_users} />
    <StatCard label="Teams"           value={overview.total_teams} />
    <StatCard label="Projects"        value={overview.total_projects} />
    <StatCard label="Test cases"      value={overview.total_cases} />
    <StatCard label="Open defects"    value={overview.open_defects} />
  </div>

  <!-- Row 2: activity pulse -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <StatCard label="Runs (30d)"        value={overview.runs_last_30d} />
    <StatCard label="Runs in progress"  value={overview.runs_in_progress} hint="right now" />
    <StatCard label="Active users (7d)" value={overview.active_users_7d} hint="distinct actors" />
    <StatCard label="New signups (7d)"  value={overview.new_users_7d} />
  </div>

  <!-- Row 3: sparklines + recent activity -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

    <!-- Two sparklines stacked -->
    <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold flex items-center gap-2 text-sm"><Activity size={14} /> Activity trend</h2>
          <span class="text-[10px] text-[var(--color-muted-foreground)]">events/day · 14d</span>
        </div>
        {#if activityPath}
          <svg viewBox="0 0 280 52" class="w-full h-14 text-[var(--color-info)]" preserveAspectRatio="none">
            <path d={activityPath} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          </svg>
          <div class="grid grid-cols-7 mt-1 text-[9px] text-[var(--color-muted-foreground)]">
            {#each overview.activity_trend.slice(-7) as t}
              <div class="text-center">{t.date.slice(5)}<br/>{t.count}</div>
            {/each}
          </div>
        {:else}
          <div class="py-6 text-center text-xs text-[var(--color-muted-foreground)]">No data yet.</div>
        {/if}
      </div>

      <div class="card p-5">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-semibold flex items-center gap-2 text-sm"><Users size={14} /> Signup trend</h2>
          <span class="text-[10px] text-[var(--color-muted-foreground)]">new users/day · 14d</span>
        </div>
        {#if signupPath}
          <svg viewBox="0 0 280 52" class="w-full h-14 text-[var(--color-success)]" preserveAspectRatio="none">
            <path d={signupPath} fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
          </svg>
          <div class="grid grid-cols-7 mt-1 text-[9px] text-[var(--color-muted-foreground)]">
            {#each overview.signup_trend.slice(-7) as t}
              <div class="text-center">{t.date.slice(5)}<br/>{t.count}</div>
            {/each}
          </div>
        {:else}
          <div class="py-6 text-center text-xs text-[var(--color-muted-foreground)]">No signups yet.</div>
        {/if}
      </div>
    </div>

    <!-- Recent activity feed -->
    <div class="card p-5">
      <h2 class="font-semibold flex items-center gap-2 mb-4 text-sm"><Zap size={14} /> Recent activity</h2>
      <ul class="divide-y text-sm max-h-64 overflow-y-auto">
        {#each activity as evt}
          <li class="py-2">
            <div class="font-medium truncate text-xs">{evt.actor_name ?? evt.actor_email ?? 'system'}</div>
            <div class="text-[10px] text-[var(--color-muted-foreground)] flex items-center gap-1 flex-wrap mt-0.5">
              <span class="badge">{evt.action}</span>
              <span>{formatDate(evt.created_at)}</span>
            </div>
          </li>
        {:else}
          <li class="py-4 text-[var(--color-muted-foreground)] text-sm">No recent activity.</li>
        {/each}
      </ul>
    </div>
  </div>

  <!-- Projects table -->
  <div class="card p-5 mb-6">
    <h2 class="font-semibold flex items-center gap-2 mb-4"><FolderOpen size={16} /> Projects ({projects.length})</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-[var(--color-muted-foreground)] uppercase">
            <th class="pb-2 pr-4">Name</th>
            <th class="pb-2 pr-4 text-right">Cases</th>
            <th class="pb-2 pr-4 text-right">Runs (30d)</th>
            <th class="pb-2 pr-4 text-right">Open defects</th>
            <th class="pb-2 text-right">Last run</th>
          </tr>
        </thead>
        <tbody>
          {#each projects as p}
            <tr class="border-t">
              <td class="py-2 pr-4">
                <div class="font-medium">{p.name}</div>
                <div class="text-xs text-[var(--color-muted-foreground)] font-mono">{p.slug}</div>
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">{p.case_count}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{p.runs_30d}</td>
              <td class="py-2 pr-4 text-right tabular-nums">
                {#if p.open_defects > 0}
                  <span class="badge badge-destructive">{p.open_defects}</span>
                {:else}
                  <span class="text-[var(--color-muted-foreground)]">—</span>
                {/if}
              </td>
              <td class="py-2 text-right text-[var(--color-muted-foreground)] text-xs">
                {p.last_run_at ? formatDate(p.last_run_at) : '—'}
              </td>
            </tr>
          {/each}
          {#if projects.length === 0}
            <tr><td colspan="5" class="py-6 text-center text-[var(--color-muted-foreground)]">No projects yet.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Users table -->
  <div class="card p-5 mb-6">
    <h2 class="font-semibold flex items-center gap-2 mb-4"><Users size={16} /> Users ({users.length})</h2>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs text-[var(--color-muted-foreground)] uppercase">
            <th class="pb-2 pr-4 cursor-pointer hover:text-[var(--color-foreground)]" on:click={() => setSort('email')}>Email{sortIcon('email')}</th>
            <th class="pb-2 pr-4">Roles</th>
            <th class="pb-2 pr-4 text-right cursor-pointer hover:text-[var(--color-foreground)] whitespace-nowrap" on:click={() => setSort('last_seen')}>Last seen{sortIcon('last_seen')}</th>
            <th class="pb-2 pr-4 text-right cursor-pointer hover:text-[var(--color-foreground)] whitespace-nowrap" on:click={() => setSort('events_30d')}>Events 30d{sortIcon('events_30d')}</th>
            <th class="pb-2 pr-4 text-right cursor-pointer hover:text-[var(--color-foreground)]" on:click={() => setSort('team_count')}>Teams{sortIcon('team_count')}</th>
            <th class="pb-2 text-right cursor-pointer hover:text-[var(--color-foreground)] whitespace-nowrap" on:click={() => setSort('created_at')}>Joined{sortIcon('created_at')}</th>
          </tr>
        </thead>
        <tbody>
          {#each sortedUsers as u}
            <tr class="border-t">
              <td class="py-2 pr-4">
                <div class="font-medium">{u.email}</div>
                {#if u.display_name && u.display_name !== u.email}
                  <div class="text-xs text-[var(--color-muted-foreground)]">{u.display_name}</div>
                {/if}
                {#if !u.is_active}<span class="badge badge-destructive text-[10px]">inactive</span>{/if}
              </td>
              <td class="py-2 pr-4">
                <div class="flex flex-wrap gap-1">
                  {#each (u.roles ?? []) as role}
                    <span class="badge text-[10px]">{role}</span>
                  {/each}
                </div>
              </td>
              <td class="py-2 pr-4 text-right text-[var(--color-muted-foreground)] text-xs whitespace-nowrap">
                {u.last_seen ? formatDate(u.last_seen) : '—'}
              </td>
              <td class="py-2 pr-4 text-right tabular-nums">{u.events_30d}</td>
              <td class="py-2 pr-4 text-right tabular-nums">{u.team_count}</td>
              <td class="py-2 text-right text-[var(--color-muted-foreground)] text-xs whitespace-nowrap">{formatDate(u.created_at)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Teams table -->
  <div class="card p-5">
    <h2 class="font-semibold flex items-center gap-2 mb-4"><Building2 size={16} /> Teams ({teams.length})</h2>
    <table class="w-full text-sm">
      <thead>
        <tr class="text-left text-xs text-[var(--color-muted-foreground)] uppercase">
          <th class="pb-2 pr-4">Name</th>
          <th class="pb-2 pr-4">Owner</th>
          <th class="pb-2 pr-4 text-right">Members</th>
          <th class="pb-2 text-right">Created</th>
        </tr>
      </thead>
      <tbody>
        {#each teams as t}
          <tr class="border-t">
            <td class="py-2 pr-4">
              <div class="font-medium">{t.name}</div>
              <div class="text-xs text-[var(--color-muted-foreground)] font-mono">{t.slug}</div>
            </td>
            <td class="py-2 pr-4 text-[var(--color-muted-foreground)]">{t.owner_name ?? t.owner_email ?? '—'}</td>
            <td class="py-2 pr-4 text-right tabular-nums">{t.member_count}</td>
            <td class="py-2 text-right text-[var(--color-muted-foreground)] text-xs whitespace-nowrap">{formatDate(t.created_at)}</td>
          </tr>
        {/each}
        {#if teams.length === 0}
          <tr><td colspan="4" class="py-6 text-center text-[var(--color-muted-foreground)]">No teams yet.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
{/if}
