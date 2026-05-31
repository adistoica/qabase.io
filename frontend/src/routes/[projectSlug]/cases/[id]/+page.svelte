<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { api } from '$lib/api';
  import type { TestCase, EmbeddedStep, Requirement } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import Markdown from '$lib/components/Markdown.svelte';
  import Comments from '$lib/components/Comments.svelte';
  import PriorityArrow from '$lib/components/PriorityArrow.svelte';
  import { ArrowLeft, Save, Plus, Trash2, Eye, Pencil, ChevronDown } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { modal } from '$lib/modal-store';

  let tc: TestCase | null = null;
  let saving = false;
  let preview = false;
  let saved = false;
  let changeNote = '';
  let allReqs: Requirement[] = [];
  let priorityPickerOpen = false;

  // Dirty tracking
  let original: string | null = null;
  $: dirty = original !== null && tc !== null && JSON.stringify(tc) !== original;

  $: id = $page.params.id;
  $: slug = $page.params.projectSlug;

  onMount(async () => {
    tc = await api.get<TestCase>(`/cases/${id}`);
    original = JSON.stringify(tc);
    try { allReqs = await api.get<Requirement[]>('/requirements'); } catch { allReqs = []; }
  });

  async function save() {
    if (!tc) return;
    saving = true;
    try {
      tc = await api.put<TestCase>(`/cases/${id}`, {
        title: tc.title,
        priority: tc.priority,
        component: tc.component,
        tags: tc.tags,
        description_md: tc.description_md,
        preconditions_md: tc.preconditions_md,
        steps: tc.steps,
        custom_fields: tc.custom_fields,
        requirement_ids: tc.requirement_ids,
        change_note: changeNote
      });
      original = JSON.stringify(tc);
      saved = true;
      changeNote = '';
      setTimeout(() => (saved = false), 1800);
    } finally {
      saving = false;
    }
  }

  function addStep() {
    if (!tc) return;
    tc.steps = [...tc.steps, { kind: 'inline', body_md: '', expected_md: '' }];
  }
  function removeStep(i: number) {
    if (!tc) return;
    tc.steps = tc.steps.filter((_, j) => j !== i);
  }
  async function archive() {
    if (!tc) return;
    if (!await modal.confirm('Archive case', 'This case will be archived and hidden from the default view.', { confirmLabel: 'Archive' })) return;
    await api.post(`/cases/${id}/archive`, undefined, { toastType: 'updated' });
    await goto(`/${slug}/cases`);
  }
  function tagsToString(tags: string[]): string { return tags.join(', '); }
  function stringToTags(s: string): string[] { return s.split(',').map((t) => t.trim()).filter(Boolean); }

  function toggleReq(reqId: string) {
    if (!tc) return;
    if (tc.requirement_ids.includes(reqId)) {
      tc.requirement_ids = tc.requirement_ids.filter((r) => r !== reqId);
    } else {
      tc.requirement_ids = [...tc.requirement_ids, reqId];
    }
  }
</script>

{#if tc}
  <PageHeader title={tc.title} subtitle={`${tc.code} · Revision ${tc.current_revision} · ${tc.component || 'no component'}`}>
    <svelte:fragment slot="actions">
      <a href={`/${slug}/cases`} class="btn btn-ghost"><ArrowLeft size={16} /> Back</a>
      <button class="btn btn-outline" on:click={() => (preview = !preview)}>
        {#if preview}<Pencil size={16} /> Edit{:else}<Eye size={16} /> Preview{/if}
      </button>
      {#if dirty}
        <span class="text-xs text-[var(--color-warning)] font-medium">Unsaved changes</span>
      {/if}
      <button class="btn btn-outline" on:click={archive}>Archive</button>
      <button class="btn btn-primary" on:click={save} disabled={saving}>
        <Save size={16} /> {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
      </button>
    </svelte:fragment>
  </PageHeader>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="card p-5 lg:col-span-2 space-y-4">
      {#if preview}
        <div><div class="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Title</div><div class="text-xl font-semibold">{tc.title}</div></div>
        {#if tc.preconditions_md}
          <div><div class="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Preconditions</div><Markdown source={tc.preconditions_md} /></div>
        {/if}
        <div><div class="text-xs font-medium text-[var(--color-muted-foreground)] mb-1">Description</div><Markdown source={tc.description_md} /></div>
        <div>
          <div class="text-xs font-medium text-[var(--color-muted-foreground)] mb-2">Steps</div>
          <ol class="space-y-3">
            {#each tc.steps as s, i}
              <li class="card p-3">
                <div class="flex items-center gap-2 mb-2">
                  <span class="badge">Step {i + 1}</span>
                  {#if s.kind === 'ref'}<span class="badge badge-info">reusable</span>{/if}
                  {#if s.title}<span class="text-sm font-medium">{s.title}</span>{/if}
                </div>
                <Markdown source={s.body_md} />
                {#if s.expected_md}<div class="mt-2 text-xs text-[var(--color-muted-foreground)]">Expected</div><Markdown source={s.expected_md} />{/if}
              </li>
            {/each}
          </ol>
        </div>
      {:else}
        <div class="space-y-1.5"><label class="text-xs font-medium" for="title">Title</label><input id="title" class="input" bind:value={tc.title} /></div>
        <div class="space-y-1.5"><label class="text-xs font-medium">Preconditions (markdown)</label><textarea class="textarea font-mono" rows="2" bind:value={tc.preconditions_md} /></div>
        <div class="space-y-1.5"><label class="text-xs font-medium" for="desc">Description (markdown)</label><textarea id="desc" class="textarea font-mono" rows="4" bind:value={tc.description_md} /></div>
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-medium">Steps</label>
            <button class="btn btn-outline btn-sm" on:click={addStep}><Plus size={14} /> Add step</button>
          </div>
          <ol class="space-y-3">
            {#each tc.steps as step, i}
              <li class="card p-3 space-y-2">
                <div class="flex items-center gap-2">
                  <span class="badge">Step {i + 1}</span>
                  {#if step.kind === 'ref'}<span class="badge badge-info">reusable: {step.title || '?'}</span>{/if}
                  <div class="flex-1"></div>
                  <button class="btn btn-ghost" on:click={() => removeStep(i)}><Trash2 size={14} /></button>
                </div>
                <textarea placeholder="What to do (markdown)…" class="textarea font-mono" rows="2" bind:value={step.body_md}></textarea>
                <textarea placeholder="Expected result (markdown)…" class="textarea font-mono" rows="2" bind:value={step.expected_md}></textarea>
              </li>
            {/each}
          </ol>
        </div>
      {/if}
    </div>

    <div class="space-y-4">
      <div class="card p-5 space-y-3">
        <!-- Priority icon picker -->
        <div class="space-y-1.5">
          <label class="text-xs font-medium">Priority</label>
          <div class="relative">
            <button
              type="button"
              class="btn btn-outline w-full justify-start gap-2"
              on:click={() => (priorityPickerOpen = !priorityPickerOpen)}
            >
              <PriorityArrow priority={tc.priority} />
              <span class="font-mono text-sm">{tc.priority}</span>
              <ChevronDown size={14} class="ml-auto text-[var(--color-muted-foreground)]" />
            </button>
            {#if priorityPickerOpen}
              <div class="fixed inset-0 z-10" on:click={() => (priorityPickerOpen = false)} aria-hidden="true"></div>
              <div class="absolute left-0 top-full mt-1 card z-20 py-1 shadow-lg w-full" role="menu">
                {#each [['P0','Critical'],['P1','High'],['P2','Medium'],['P3','Low']] as [p, label]}
                  <button
                    type="button"
                    class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--color-muted)] {tc.priority === p ? 'bg-[var(--color-accent)]' : ''}"
                    on:click={() => { tc.priority = p; priorityPickerOpen = false; }}
                  >
                    <PriorityArrow priority={p} />
                    <span class="font-mono text-xs font-medium">{p}</span>
                    <span class="text-xs text-[var(--color-muted-foreground)]">{label}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <div class="space-y-1.5"><label class="text-xs font-medium">Component</label><input class="input" bind:value={tc.component} placeholder="auth, payments…" /></div>
        <div class="space-y-1.5"><label class="text-xs font-medium">Tags (comma-separated)</label>
          <input class="input" value={tagsToString(tc.tags)}
            on:change={(e) => tc && (tc.tags = stringToTags((e.target as HTMLInputElement).value))} />
        </div>
      </div>

      {#if allReqs.length}
        <div class="card p-5 space-y-2">
          <div class="text-xs font-medium text-[var(--color-muted-foreground)]">Requirements</div>
          <div class="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
            {#each allReqs as r}
              <label class="flex items-center gap-2 px-2 py-1 border rounded-md text-xs cursor-pointer">
                <input type="checkbox" checked={tc.requirement_ids.includes(r.id)} on:change={() => toggleReq(r.id)} />
                <span class="font-mono text-[var(--color-muted-foreground)]">{r.external_id || ''}</span>
                {r.title}
              </label>
            {/each}
          </div>
        </div>
      {/if}

      <div class="card p-5 space-y-2">
        <div class="text-xs font-medium text-[var(--color-muted-foreground)]">Change note</div>
        <input class="input" placeholder="Why this edit?" bind:value={changeNote} />
        <p class="text-[11px] text-[var(--color-muted-foreground)]">Saved with the next revision in the history.</p>
      </div>
    </div>
  </div>

  <div class="mt-6">
    <Comments targetKind="case" targetId={id} />
  </div>
{:else}
  <!-- skeleton loader -->
  <div class="animate-pulse space-y-6">
    <div class="flex items-center gap-4 pb-6 border-b">
      <div class="h-7 w-64 rounded bg-[var(--color-muted)]"></div>
      <div class="ml-auto flex gap-2">
        <div class="h-9 w-16 rounded bg-[var(--color-muted)]"></div>
        <div class="h-9 w-20 rounded bg-[var(--color-muted)]"></div>
        <div class="h-9 w-16 rounded bg-[var(--color-muted)]"></div>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="card p-5 lg:col-span-2 space-y-4">
        <div class="h-9 rounded bg-[var(--color-muted)]"></div>
        <div class="h-16 rounded bg-[var(--color-muted)]"></div>
        <div class="h-24 rounded bg-[var(--color-muted)]"></div>
      </div>
      <div class="space-y-4">
        <div class="card p-5 space-y-3">
          <div class="h-9 rounded bg-[var(--color-muted)]"></div>
          <div class="h-9 rounded bg-[var(--color-muted)]"></div>
          <div class="h-9 rounded bg-[var(--color-muted)]"></div>
        </div>
      </div>
    </div>
  </div>
{/if}
