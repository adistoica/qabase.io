<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { ExploratorySession } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import {
    Bug,
    Camera,
    CheckCircle2,
    Clock3,
    Compass,
    Pause,
    Play,
    Plus,
    Save,
    Trash2,
    Upload,
    X,
  } from '@lucide/svelte';
  import { modal } from '$lib/modal-store';

  let sessions: ExploratorySession[] = [];
  let selected: ExploratorySession | null = null;
  let loading = true;
  let filterStatus = '';
  let showCreate = false;
  let saving = false;
  let error = '';
  let now = Date.now();
  let ticker: ReturnType<typeof setInterval> | undefined;

  let form = { title: '', charter: '' };
  let edit = { title: '', charter: '', notes_md: '' };
  let bugForm = { title: '', description_md: '', severity: 'medium', external_url: '' };
  let bugError = '';
  let uploadError = '';

  $: displayedElapsed = selected ? elapsedSeconds(selected) : 0;

  async function load(selectId?: string) {
    loading = true;
    const qs = filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : '';
    sessions = await api.get<ExploratorySession[]>(`/exploratory-sessions${qs}`);
    const next = selectId
      ? sessions.find((s) => s.id === selectId)
      : selected
        ? sessions.find((s) => s.id === selected?.id)
        : sessions[0];
    select(next ?? null);
    loading = false;
  }

  onMount(() => {
    load();
    ticker = setInterval(() => (now = Date.now()), 1000);
  });

  onDestroy(() => {
    if (ticker) clearInterval(ticker);
  });

  function select(session: ExploratorySession | null) {
    selected = session;
    if (session) {
      edit = {
        title: session.title,
        charter: session.charter,
        notes_md: session.notes_md,
      };
      bugError = '';
      uploadError = '';
    }
  }

  async function createSession() {
    if (!form.title.trim()) {
      error = 'Title is required';
      return;
    }
    saving = true;
    error = '';
    try {
      const created = await api.post<ExploratorySession>('/exploratory-sessions', {
        title: form.title.trim(),
        charter: form.charter,
      });
      form = { title: '', charter: '' };
      showCreate = false;
      await load(created.id);
    } catch (e: any) {
      error = e?.detail ?? 'Create failed';
    } finally {
      saving = false;
    }
  }

  async function saveSession() {
    if (!selected) return;
    saving = true;
    error = '';
    try {
      selected = await api.put<ExploratorySession>(`/exploratory-sessions/${selected.id}`, {
        title: edit.title,
        charter: edit.charter,
        notes_md: edit.notes_md,
      });
      sessions = sessions.map((s) => (s.id === selected?.id ? selected : s));
    } catch (e: any) {
      error = e?.detail ?? 'Save failed';
    } finally {
      saving = false;
    }
  }

  async function transition(action: 'pause' | 'resume' | 'complete') {
    if (!selected) return;
    selected = await api.post<ExploratorySession>(`/exploratory-sessions/${selected.id}/${action}`, undefined, { toastType: 'updated' });
    sessions = sessions.map((s) => (s.id === selected?.id ? selected : s));
  }

  async function addBug() {
    if (!selected) return;
    if (!bugForm.title.trim()) {
      bugError = 'Title is required';
      return;
    }
    bugError = '';
    selected = await api.post<ExploratorySession>(`/exploratory-sessions/${selected.id}/bugs`, {
      title: bugForm.title.trim(),
      description_md: bugForm.description_md,
      severity: bugForm.severity,
      external_url: bugForm.external_url,
    });
    sessions = sessions.map((s) => (s.id === selected?.id ? selected : s));
    bugForm = { title: '', description_md: '', severity: 'medium', external_url: '' };
  }

  async function removeBug(id: string) {
    if (!selected) return;
    selected = await api.del<ExploratorySession>(`/exploratory-sessions/${selected.id}/bugs/${id}`);
    sessions = sessions.map((s) => (s.id === selected?.id ? selected : s));
  }

  async function uploadScreenshot(event: Event) {
    if (!selected) return;
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    uploadError = '';
    const data = new FormData();
    data.append('file', file);
    try {
      selected = await api.upload<ExploratorySession>(`/exploratory-sessions/${selected.id}/screenshots`, data);
      sessions = sessions.map((s) => (s.id === selected?.id ? selected : s));
    } catch (e: any) {
      uploadError = e?.detail ?? 'Upload failed';
    } finally {
      input.value = '';
    }
  }

  async function removeSession() {
    if (!selected) return;
    if (!await modal.confirm('Delete session', 'This exploratory session will be permanently deleted.', { destructive: true })) return;
    const id = selected.id;
    await api.del(`/exploratory-sessions/${id}`);
    selected = null;
    await load();
  }

  function elapsedSeconds(session: ExploratorySession) {
    let elapsed = session.elapsed_seconds;
    if (session.status === 'active' && session.active_since) {
      elapsed += Math.max(0, Math.floor((now - new Date(session.active_since).getTime()) / 1000));
    }
    return elapsed;
  }

  function formatDuration(total: number) {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
  }

  function statusBadge(status: string) {
    if (status === 'active') return 'badge badge-success';
    if (status === 'paused') return 'badge badge-warning';
    return 'badge';
  }

  function severityBadge(severity: string) {
    if (severity === 'critical') return 'badge badge-destructive';
    if (severity === 'high') return 'badge badge-warning';
    if (severity === 'medium') return 'badge badge-info';
    return 'badge';
  }

  function screenshotUrl(id: string) {
    return selected ? `/api/exploratory-sessions/${selected.id}/screenshots/${id}` : '';
  }
</script>

<PageHeader title="Exploratory">
  <svelte:fragment slot="actions">
    <button class="btn btn-primary" on:click={() => (showCreate = !showCreate)}>
      <Plus size={16} /> New session
    </button>
  </svelte:fragment>
</PageHeader>

<div class="p-4 space-y-4">
  {#if showCreate}
    <div class="card p-4 space-y-3 border-2 border-[var(--color-accent)]">
      <div class="font-medium text-sm">New exploratory session</div>
      {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
      <input class="input w-full" placeholder="Title *" bind:value={form.title} />
      <textarea class="textarea w-full h-24" placeholder="Charter" bind:value={form.charter}></textarea>
      <div class="flex gap-2">
        <button class="btn btn-primary" on:click={createSession} disabled={saving}>
          <Play size={14} /> {saving ? 'Starting...' : 'Start'}
        </button>
        <button class="btn btn-ghost" on:click={() => (showCreate = false)}><X size={14} /> Cancel</button>
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-1 xl:grid-cols-[22rem_1fr] gap-4">
    <section class="card overflow-hidden">
      <div class="p-3 border-b flex items-center gap-2">
        <select class="input" bind:value={filterStatus} on:change={() => load()}>
          <option value="">All sessions</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {#if loading}
        <p class="p-4 text-sm text-[var(--color-muted-foreground)]">Loading...</p>
      {:else if sessions.length === 0}
        <div class="p-8 text-center text-[var(--color-muted-foreground)]">
          <Compass size={32} class="mx-auto mb-2 opacity-30" />
          <p class="text-sm">No exploratory sessions yet.</p>
        </div>
      {:else}
        <div class="divide-y max-h-[calc(100vh-14rem)] overflow-y-auto">
          {#each sessions as session (session.id)}
            <button
              type="button"
              class="w-full text-left p-3 hover:bg-[var(--color-muted)] {selected?.id === session.id ? 'bg-[var(--color-accent)]' : ''}"
              on:click={() => select(session)}
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-medium text-sm truncate">{session.title}</div>
                  <div class="text-xs text-[var(--color-muted-foreground)] truncate">{session.charter || 'No charter'}</div>
                </div>
                <span class={statusBadge(session.status)}>{session.status}</span>
              </div>
              <div class="mt-2 flex items-center gap-3 text-xs text-[var(--color-muted-foreground)]">
                <span class="inline-flex items-center gap-1"><Clock3 size={12} /> {formatDuration(elapsedSeconds(session))}</span>
                <span class="inline-flex items-center gap-1"><Bug size={12} /> {session.discovered_bugs.length}</span>
                <span class="inline-flex items-center gap-1"><Camera size={12} /> {session.screenshots.length}</span>
              </div>
            </button>
          {/each}
        </div>
      {/if}
    </section>

    {#if selected}
      <section class="space-y-4">
        <div class="card p-4 space-y-4">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span class={statusBadge(selected.status)}>{selected.status}</span>
                <span class="text-xs text-[var(--color-muted-foreground)]">Started {formatDate(selected.started_at)}</span>
              </div>
              <div class="mt-2 text-3xl font-semibold tabular-nums">{formatDuration(displayedElapsed)}</div>
            </div>
            <div class="flex gap-2 flex-wrap">
              {#if selected.status === 'active'}
                <button class="btn btn-outline" on:click={() => transition('pause')}><Pause size={15} /> Pause</button>
              {:else if selected.status === 'paused'}
                <button class="btn btn-outline" on:click={() => transition('resume')}><Play size={15} /> Resume</button>
              {/if}
              {#if selected.status !== 'completed'}
                <button class="btn btn-primary" on:click={() => transition('complete')}><CheckCircle2 size={15} /> Complete</button>
              {/if}
              <button class="btn btn-ghost text-[var(--color-destructive)]" on:click={removeSession}><Trash2 size={15} /> Delete</button>
            </div>
          </div>

          {#if error}<p class="text-xs text-[var(--color-destructive)]">{error}</p>{/if}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <label class="label">Title</label>
              <input class="input w-full" bind:value={edit.title} />
            </div>
            <div>
              <label class="label">Charter</label>
              <input class="input w-full" bind:value={edit.charter} />
            </div>
          </div>
          <div>
            <label class="label">Notes</label>
            <textarea class="textarea w-full min-h-64 font-mono text-xs" bind:value={edit.notes_md}></textarea>
          </div>
          <button class="btn btn-primary" on:click={saveSession} disabled={saving}>
            <Save size={15} /> {saving ? 'Saving...' : 'Save session'}
          </button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="card p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-sm">Discovered bugs</h2>
              <span class="badge">{selected.discovered_bugs.length}</span>
            </div>
            {#if selected.discovered_bugs.length === 0}
              <p class="text-xs text-[var(--color-muted-foreground)]">No bugs captured for this session.</p>
            {:else}
              <ul class="space-y-2">
                {#each selected.discovered_bugs as bug}
                  <li class="border rounded-md p-3 space-y-1">
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-medium">{bug.title}</div>
                        <div class="flex items-center gap-2 mt-1">
                          <span class={severityBadge(bug.severity)}>{bug.severity}</span>
                          <span class="text-xs text-[var(--color-muted-foreground)]">{formatDate(bug.created_at)}</span>
                        </div>
                      </div>
                      <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" on:click={() => removeBug(bug.id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {#if bug.description_md}<p class="text-xs whitespace-pre-wrap">{bug.description_md}</p>{/if}
                    {#if bug.external_url}<a class="text-xs text-[var(--color-info)] hover:underline" href={bug.external_url} target="_blank">{bug.external_url}</a>{/if}
                  </li>
                {/each}
              </ul>
            {/if}

            <div class="border-t pt-3 space-y-2">
              {#if bugError}<p class="text-xs text-[var(--color-destructive)]">{bugError}</p>{/if}
              <input class="input w-full" placeholder="Bug title" bind:value={bugForm.title} />
              <textarea class="textarea w-full h-20" placeholder="Notes" bind:value={bugForm.description_md}></textarea>
              <div class="grid grid-cols-1 sm:grid-cols-[10rem_1fr_auto] gap-2">
                <select class="input" bind:value={bugForm.severity}>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <input class="input" placeholder="External URL" bind:value={bugForm.external_url} />
                <button class="btn btn-outline" on:click={addBug}><Plus size={14} /> Add</button>
              </div>
            </div>
          </div>

          <div class="card p-4 space-y-3">
            <div class="flex items-center justify-between gap-2">
              <h2 class="font-semibold text-sm">Screenshots</h2>
              <label class="btn btn-outline cursor-pointer">
                <Upload size={14} /> Upload
                <input class="hidden" type="file" accept="image/*" on:change={uploadScreenshot} />
              </label>
            </div>
            {#if uploadError}<p class="text-xs text-[var(--color-destructive)]">{uploadError}</p>{/if}
            {#if selected.screenshots.length === 0}
              <p class="text-xs text-[var(--color-muted-foreground)]">No screenshots attached.</p>
            {:else}
              <div class="grid grid-cols-2 gap-3">
                {#each selected.screenshots as screenshot}
                  <a class="block border rounded-md overflow-hidden hover:bg-[var(--color-muted)]" href={screenshotUrl(screenshot.id)} target="_blank">
                    {#if screenshot.mime.startsWith('image/')}
                      <img class="w-full aspect-video object-cover bg-[var(--color-muted)]" src={screenshotUrl(screenshot.id)} alt={screenshot.original_name || 'Screenshot'} />
                    {:else}
                      <div class="aspect-video grid place-items-center bg-[var(--color-muted)]">
                        <Camera size={24} class="opacity-40" />
                      </div>
                    {/if}
                    <div class="p-2 text-xs">
                      <div class="truncate font-medium">{screenshot.original_name || screenshot.id}</div>
                      <div class="text-[var(--color-muted-foreground)]">{Math.ceil(screenshot.size / 1024)} KB</div>
                    </div>
                  </a>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </section>
    {:else if !loading}
      <section class="card p-8 text-center text-[var(--color-muted-foreground)]">
        <Compass size={36} class="mx-auto mb-2 opacity-30" />
        <p class="text-sm">Select or start a session.</p>
      </section>
    {/if}
  </div>
</div>
