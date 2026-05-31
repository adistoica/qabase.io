<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Comment } from '$lib/api';
  import { formatDate } from '$lib/format';
  import { Send, MessageSquare } from '@lucide/svelte';

  export let targetKind: 'case' | 'run' | 'milestone' | 'plan' | 'requirement';
  export let targetId: string;

  let items: Comment[] = [];
  let body = '';
  let posting = false;
  let loading = true;

  async function load() {
    loading = true;
    items = await api.get<Comment[]>(
      `/comments?target_kind=${targetKind}&target_id=${targetId}`
    );
    loading = false;
  }

  async function post() {
    if (!body.trim()) return;
    posting = true;
    try {
      const c = await api.post<Comment>('/comments', {
        target_kind: targetKind,
        target_id: targetId,
        body_md: body,
      });
      items = [...items, c];
      body = '';
    } finally {
      posting = false;
    }
  }

  onMount(load);
</script>

<div class="card p-5">
  <h3 class="font-semibold flex items-center gap-2 mb-3">
    <MessageSquare size={16} /> Comments
  </h3>
  {#if loading}
    <div class="text-xs text-[var(--color-muted-foreground)]">Loading…</div>
  {:else}
    <ul class="space-y-3 mb-4">
      {#each items as c}
        <li class="text-sm">
          <div class="flex items-baseline gap-2">
            <span class="font-medium">{c.author_display_name || c.author_email}</span>
            <span class="text-xs text-[var(--color-muted-foreground)]">{formatDate(c.created_at)}</span>
          </div>
          <div class="mt-1 whitespace-pre-wrap text-[var(--color-foreground)]">{c.body_md}</div>
        </li>
      {:else}
        <li class="text-xs text-[var(--color-muted-foreground)]">No comments yet.</li>
      {/each}
    </ul>
  {/if}
  <div class="flex gap-2">
    <input
      class="input"
      placeholder="Add a comment… use @name to mention"
      bind:value={body}
      on:keydown={(e) => e.key === 'Enter' && post()}
    />
    <button class="btn btn-primary" disabled={posting || !body.trim()} on:click={post}>
      <Send size={14} />
    </button>
  </div>
</div>
