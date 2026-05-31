<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import type { Run, User, ResultStatus, TestCase } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import {
    ArrowLeft, CheckCircle, XCircle, MinusCircle, Ban, Flag,
    Paperclip, RotateCw, Bug, Download, Printer, Share2,
  } from '@lucide/svelte';
  import { formatPct, statusBadgeClass, priorityClass } from '$lib/format';
  import { goto } from '$app/navigation';
  import { modal } from '$lib/modal-store';
  import { toast } from '$lib/toast-store';

  let run: Run | null = null;
  let activeIdx = 0;
  let saving = false;
  let showFinish = false;
  let users: User[] = [];
  let activeFullCase: TestCase | null = null;
  let loadingCase = false;

  $: id = $page.params.id;
  $: slug = $page.params.projectSlug;
  $: activeResult = run && run.results[activeIdx];
  $: activeCase = run && (run as any).case_snapshot ? (run as any).case_snapshot[activeIdx] : null;
  $: doneCases = run ? run.results.filter(r => r.status !== 'pending').length : 0;
  $: progressPct = run && run.summary.total > 0 ? (doneCases / run.summary.total) * 100 : 0;

  // Load step body text whenever the active result changes
  $: if (activeResult) {
    fetchActiveCase(activeResult.test_case_id);
  }

  async function fetchActiveCase(caseId: string) {
    loadingCase = true;
    activeFullCase = null;
    try {
      activeFullCase = await api.get<TestCase>(`/cases/${caseId}`);
    } catch {
      activeFullCase = null;
    } finally {
      loadingCase = false;
    }
  }

  async function load() {
    run = await api.get<Run>(`/runs/${id}`);
    const firstPending = run.results.findIndex((r) => r.status === 'pending');
    if (firstPending >= 0) activeIdx = firstPending;
  }

  async function loadUsers() {
    try {
      users = await api.get<User[]>('/users');
    } catch { users = []; }
  }

  async function setStatus(status: ResultStatus) {
    if (!run || !activeResult) return;
    saving = true;
    try {
      run = await api.put<Run>(`/runs/${id}/results/${activeIdx}`, { status }, { silent: true });
      // Auto-advance to next case after marking
      if (activeIdx < run.results.length - 1) {
        next();
      }
    } finally {
      saving = false;
    }
  }

  async function setStepStatus(position: number, status: ResultStatus) {
    if (!run || !activeResult) return;
    saving = true;
    try {
      run = await api.put<Run>(`/runs/${id}/results/${activeIdx}`, {
        step_results: [{ position, status, notes_md: '' }]
      }, { silent: true });
    } finally {
      saving = false;
    }
  }

  async function saveNotes(notes: string) {
    if (!run) return;
    saving = true;
    try {
      run = await api.put<Run>(`/runs/${id}/results/${activeIdx}`, { notes_md: notes }, { silent: true });
    } finally {
      saving = false;
    }
  }

  async function assignTo(userId: string) {
    if (!run) return;
    run = await api.put<Run>(`/runs/${id}/results/${activeIdx}`, { assigned_to: userId || null }, { silent: true });
  }

  async function uploadAttachment(stepPos: number, file: File) {
    if (!run) return;
    const form = new FormData();
    form.append('file', file);
    saving = true;
    try {
      await api.upload(
        `/runs/${id}/results/${activeIdx}/steps/${stepPos}/attachments`,
        form
      );
      run = await api.get<Run>(`/runs/${id}`);
    } finally {
      saving = false;
    }
  }

  async function fileForStep(e: Event, stepPos: number) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) await uploadAttachment(stepPos, f);
  }

  function next() {
    if (!run) return;
    activeIdx = Math.min(activeIdx + 1, run.results.length - 1);
  }
  function prev() {
    activeIdx = Math.max(activeIdx - 1, 0);
  }

  async function finishRun() {
    run = await api.post<Run>(`/runs/${id}/finish`, undefined, { toastType: 'updated' });
    showFinish = false;
  }

  async function rerunFailed() {
    try {
      const r = await api.post<{ id: string }>(`/runs/${id}/rerun-failed`);
      await goto(`/${slug}/runs/${r.id}`);
    } catch {
      // error toast shown automatically
    }
  }

  async function createJiraFromActive() {
    if (!activeResult) return;
    try {
      const r = await api.post<{ key: string; url: string }>(
        '/integrations/jira/from-result',
        { run_id: id, result_index: activeIdx },
        { silent: true }
      );
      toast.success(`Jira issue ${r.key} created`);
      run = await api.get<Run>(`/runs/${id}`);
    } catch (e: any) {
      toast.error(e?.detail || 'Jira create failed');
    }
  }

  async function share() {
    try {
      const r = await api.post<{ token: string }>('/share', {
        kind: 'run', target_id: id, ttl_days: 30,
      }, { silent: true });
      const url = `${window.location.origin}/api/public/run/${r.token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Share link copied to clipboard');
    } catch (e: any) {
      toast.error(e?.detail || 'Share failed');
    }
  }

  function exportCsv() {
    window.open(`/api/exports/runs/${id}.csv`, '_blank');
  }
  function printableHtml() {
    window.open(`/api/exports/runs/${id}.html`, '_blank');
  }

  function onKey(e: KeyboardEvent) {
    if (!run) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const k = e.key.toLowerCase();
    if (k === 'p') setStatus('passed');
    else if (k === 'f') setStatus('failed');
    else if (k === 'b') setStatus('blocked');
    else if (k === 's') setStatus('skipped');
    else if (k === 'arrowdown' || k === 'j') next();
    else if (k === 'arrowup' || k === 'k') prev();
    else if (k === '?') modal.alert('Keyboard shortcuts', 'P — pass  ·  F — fail  ·  B — blocked  ·  S — skipped\nJ / ↓ — next  ·  K / ↑ — previous');
  }

  onMount(() => {
    load();
    loadUsers();
    window.addEventListener('keydown', onKey);
  });
  onDestroy(() => window.removeEventListener('keydown', onKey));

  function statusLabel(status: string): string {
    switch (status) {
      case 'passed':  return 'Pass';
      case 'failed':  return 'Fail';
      case 'blocked': return 'Blkd';
      case 'skipped': return 'Skip';
      case 'pending': return 'Pend';
      default:        return status.slice(0, 4);
    }
  }
</script>

{#if run}
  <PageHeader
    title={run.name}
    subtitle={`${run.summary.total} cases · ${formatPct(run.summary.pass_rate)} passing · status: ${run.status} · source: ${run.source}`}
  >
    <svelte:fragment slot="actions">
      <a href={`/${slug}/runs`} class="btn btn-ghost"><ArrowLeft size={16} /> All runs</a>
      <button class="btn btn-outline" on:click={share}><Share2 size={14} /> Share</button>
      <button class="btn btn-outline" on:click={exportCsv}><Download size={14} /> CSV</button>
      <button class="btn btn-outline" on:click={printableHtml}><Printer size={14} /> Print</button>
      {#if run.summary.failed > 0}
        <button class="btn btn-outline" on:click={rerunFailed}><RotateCw size={14} /> Re-run failed</button>
      {/if}
      {#if run.status === 'in_progress'}
        <button class="btn btn-primary" on:click={() => (showFinish = true)}><Flag size={16} /> Finish run</button>
      {/if}
    </svelte:fragment>
  </PageHeader>

  <!-- summary stat cards -->
  <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 text-sm">
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Total</div><div class="font-semibold text-lg">{run.summary.total}</div></div>
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Passed</div><div class="font-semibold text-lg text-[var(--color-success)]">{run.summary.passed}</div></div>
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Failed</div><div class="font-semibold text-lg text-[var(--color-destructive)]">{run.summary.failed}</div></div>
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Blocked</div><div class="font-semibold text-lg text-[var(--color-warning)]">{run.summary.blocked}</div></div>
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Skipped</div><div class="font-semibold text-lg">{run.summary.skipped}</div></div>
    <div class="card px-4 py-3"><div class="text-xs text-[var(--color-muted-foreground)]">Pending</div><div class="font-semibold text-lg">{run.summary.pending}</div></div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
    <!-- case list panel with progress bar -->
    <div class="card overflow-hidden flex flex-col">
      <div class="px-3 pt-3 pb-2 border-b">
        <div class="flex items-center justify-between text-xs text-[var(--color-muted-foreground)] mb-1.5">
          <span class="font-medium">{doneCases} / {run.summary.total} done</span>
          {#if run.summary.failed > 0}
            <span class="text-[var(--color-destructive)] font-medium">{run.summary.failed} failed</span>
          {/if}
        </div>
        <div class="h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
          <div
            class="h-full rounded-full bg-[var(--color-success)] transition-all duration-300"
            style="width: {progressPct}%"
          ></div>
        </div>
      </div>
      <ul class="flex-1 max-h-[65vh] overflow-y-auto">
        {#each run.results as r, i}
          <li>
            <button
              type="button"
              class="w-full text-left px-3 py-2 text-sm flex items-center gap-2 border-b last:border-b-0 {i === activeIdx ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-muted)]'}"
              on:click={() => (activeIdx = i)}
            >
              <span class="{statusBadgeClass(r.status)} tabular-nums" style="min-width: 40px; justify-content:center; font-size:0.7rem;">{statusLabel(r.status)}</span>
              <span class="font-mono text-[10px] text-[var(--color-muted-foreground)] shrink-0">{r.code}</span>
              <span class="truncate">{r.title}</span>
            </button>
          </li>
        {/each}
      </ul>
    </div>

    <!-- execution detail panel -->
    <div class="space-y-4">
      <div class="card p-6">
        {#if activeResult}
          <div class="flex items-center gap-3 mb-2 flex-wrap">
            {#if activeCase}
              <span class="font-mono text-xs text-[var(--color-muted-foreground)]">{activeCase.code}</span>
              <span class={priorityClass(activeCase.priority)}>{activeCase.priority}</span>
              <span class="text-xs text-[var(--color-muted-foreground)]">{activeCase.component}</span>
            {/if}
            <span class={statusBadgeClass(activeResult.status)}>{activeResult.status}</span>
            <div class="flex-1"></div>
            <select class="input w-44" value={activeResult.assigned_to || ''} on:change={(e) => assignTo((e.target as HTMLSelectElement).value)}>
              <option value="">Unassigned</option>
              {#each users as u}<option value={u.id}>{u.display_name || u.email}</option>{/each}
            </select>
          </div>
          <h2 class="text-xl font-semibold mb-5">{activeResult.title}</h2>

          <!-- step-by-step execution -->
          <ol class="space-y-3">
            {#each activeResult.step_results as sr, j}
              {@const stepDef = activeFullCase?.steps[j]}
              <li class="card p-4">
                <div class="flex items-center justify-between gap-3 mb-2">
                  <div class="text-sm font-medium text-[var(--color-muted-foreground)]">
                    Step {j + 1}{stepDef?.title ? ` — ${stepDef.title}` : ''}
                  </div>
                  <div class="flex items-center gap-1">
                    <button title="Pass (p)" class="btn btn-ghost px-2" on:click={() => setStepStatus(j, 'passed')}><CheckCircle size={16} class="text-[var(--color-success)]" /></button>
                    <button title="Fail (f)" class="btn btn-ghost px-2" on:click={() => setStepStatus(j, 'failed')}><XCircle size={16} class="text-[var(--color-destructive)]" /></button>
                    <button title="Blocked (b)" class="btn btn-ghost px-2" on:click={() => setStepStatus(j, 'blocked')}><MinusCircle size={16} class="text-[var(--color-warning)]" /></button>
                    <button title="Skip (s)" class="btn btn-ghost px-2" on:click={() => setStepStatus(j, 'skipped')}><Ban size={16} /></button>
                    <label class="btn btn-ghost px-2 cursor-pointer" title="Attach screenshot/log">
                      <Paperclip size={16} />
                      <input type="file" class="hidden" on:change={(e) => fileForStep(e, j)} />
                    </label>
                    <span class="{statusBadgeClass(sr.status)}" style="min-width: 44px; justify-content:center; font-size:0.7rem;">{statusLabel(sr.status)}</span>
                  </div>
                </div>

                {#if loadingCase && !stepDef}
                  <div class="h-3 w-3/4 rounded bg-[var(--color-muted)] animate-pulse mb-2"></div>
                {:else if stepDef?.body_md}
                  <div class="text-sm leading-relaxed mb-2"><Markdown source={stepDef.body_md} /></div>
                {/if}

                {#if stepDef?.expected_md}
                  <div class="text-xs border-l-2 border-[var(--color-info)] pl-3 text-[var(--color-muted-foreground)]">
                    <span class="font-medium text-[var(--color-foreground)]">Expected:</span>
                    {stepDef.expected_md}
                  </div>
                {/if}

                {#if sr.attachment_ids.length}
                  <div class="text-xs text-[var(--color-muted-foreground)] mt-2">
                    {sr.attachment_ids.length} attachment(s) — <a class="hover:underline" href={`/api/runs/${id}/attachments`} target="_blank">view list</a>
                  </div>
                {/if}
              </li>
            {/each}
          </ol>

          <div class="mt-5">
            <label class="text-xs font-medium text-[var(--color-muted-foreground)]">Notes for this case</label>
            <textarea class="textarea font-mono mt-1" rows="3" value={activeResult.notes_md} on:blur={(e) => saveNotes((e.target as HTMLTextAreaElement).value)} />
          </div>

          {#if activeResult.defect_links.length}
            <div class="mt-3">
              <div class="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Defects</div>
              <div class="flex flex-wrap gap-2">
                {#each activeResult.defect_links as d}
                  <a class="badge badge-info hover:underline" href={d.url} target="_blank" rel="noopener">
                    {d.system}:{d.external_id}
                  </a>
                {/each}
              </div>
            </div>
          {/if}

          <!-- case-level verdict buttons -->
          <div class="mt-6 flex flex-wrap items-center gap-2">
            <button class="btn btn-success" disabled={saving} on:click={() => setStatus('passed')}><CheckCircle size={16} /> Pass (P)</button>
            <button class="btn btn-destructive" disabled={saving} on:click={() => setStatus('failed')}><XCircle size={16} /> Fail (F)</button>
            <button class="btn btn-outline" disabled={saving} on:click={() => setStatus('blocked')}><MinusCircle size={16} /> Blocked (B)</button>
            <button class="btn btn-outline" disabled={saving} on:click={() => setStatus('skipped')}><Ban size={16} /> Skip (S)</button>
            {#if activeResult.status === 'failed'}
              <button class="btn btn-outline" on:click={createJiraFromActive}><Bug size={14} /> Create Jira</button>
            {/if}
            <div class="flex-1"></div>
            <button class="btn btn-ghost" on:click={prev} disabled={activeIdx === 0}>← Prev</button>
            <button class="btn btn-ghost" on:click={next} disabled={activeIdx === run.results.length - 1}>Next →</button>
          </div>

          <!-- persistent keyboard shortcut strip -->
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted-foreground)] mt-4 pt-3 border-t select-none">
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">P</kbd> pass</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">F</kbd> fail</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">B</kbd> blocked</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">S</kbd> skip</span>
            <span class="text-[var(--color-border)]">·</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">J</kbd>/<kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">↓</kbd> next</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">K</kbd>/<kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">↑</kbd> prev</span>
            <span class="text-[var(--color-border)]">·</span>
            <span><kbd class="font-mono bg-[var(--color-muted)] px-1 rounded text-[10px]">?</kbd> all shortcuts</span>
          </div>
        {/if}
      </div>

      <Comments targetKind="run" targetId={id} />
    </div>
  </div>

  {#if showFinish}
    <div class="fixed inset-0 bg-black/40 grid place-items-center z-50" on:click={() => (showFinish = false)}>
      <div class="card p-6 w-full max-w-md" on:click|stopPropagation>
        <h3 class="font-semibold text-lg">Finish this run?</h3>
        <p class="text-sm text-[var(--color-muted-foreground)] mt-1">Marking it complete locks the result snapshot and fires notifications.</p>
        <div class="flex justify-end gap-2 mt-5">
          <button class="btn btn-ghost" on:click={() => (showFinish = false)}>Cancel</button>
          <button class="btn btn-primary" on:click={finishRun}>Yes, finish</button>
        </div>
      </div>
    </div>
  {/if}
{:else}
  <!-- skeleton loader -->
  <div class="animate-pulse space-y-4">
    <div class="flex items-center gap-4 mb-6">
      <div class="h-7 w-48 rounded bg-[var(--color-muted)]"></div>
      <div class="h-4 w-64 rounded bg-[var(--color-muted)]"></div>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {#each Array(6) as _}
        <div class="card px-4 py-3">
          <div class="h-3 w-12 rounded bg-[var(--color-muted)] mb-2"></div>
          <div class="h-7 w-8 rounded bg-[var(--color-muted)]"></div>
        </div>
      {/each}
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <div class="card h-96"></div>
      <div class="card h-96 p-6 space-y-3">
        <div class="h-5 w-3/4 rounded bg-[var(--color-muted)]"></div>
        <div class="h-4 w-1/2 rounded bg-[var(--color-muted)]"></div>
        {#each Array(3) as _}
          <div class="card p-4 h-16"></div>
        {/each}
      </div>
    </div>
  </div>
{/if}
