<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Comment } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { MessageSquare } from '@lucide/svelte';
  import { formatDate } from '$lib/format';
  import { page } from '$app/stores';

  $: slug = $page.params.projectSlug;

  let items: Comment[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
      items = await api.get<Comment[]>('/comments/inbox');
    } catch (e: any) {
      error = e?.detail ?? 'Failed to load mentions.';
    } finally {
      loading = false;
    }
  });

  function targetHref(c: Comment): string | null {
    switch (c.target_kind) {
      case 'case':        return `/${slug}/cases/${c.target_id}`;
      case 'run':         return `/${slug}/runs/${c.target_id}`;
      case 'defect':      return `/${slug}/defects/${c.target_id}`;
      case 'milestone':   return `/${slug}/milestones`;
      case 'plan':        return `/${slug}/plans`;
      case 'requirement': return `/${slug}/requirements`;
      default:            return null;
    }
  }

  function targetLabel(kind: string): string {
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
</script>

<PageHeader title="Mentions" subtitle="Comments where you were mentioned." />

{#if error}
  <div class="card p-6 text-sm text-[var(--color-destructive)]">{error}</div>
{:else if loading}
  <div class="card">
    <ul class="divide-y divide-[var(--color-border)]">
      {#each Array(5) as _}
        <li class="px-4 py-4 space-y-2 animate-pulse">
          <div class="flex items-center gap-2">
            <div class="h-3 w-24 rounded bg-[var(--color-muted)]"></div>
            <div class="h-3 w-16 rounded bg-[var(--color-muted)]"></div>
          </div>
          <div class="h-3 w-3/4 rounded bg-[var(--color-muted)]"></div>
        </li>
      {/each}
    </ul>
  </div>
{:else if items.length === 0}
  <div class="card p-12 text-center">
    <MessageSquare size={28} class="mx-auto mb-2 text-[var(--color-muted-foreground)]" />
    <div class="text-sm text-[var(--color-muted-foreground)]">No mentions yet.</div>
  </div>
{:else}
  <div class="card">
    <ul class="divide-y divide-[var(--color-border)]">
      {#each items as c}
        {@const href = targetHref(c)}
        <li class="px-4 py-4">
          <div class="flex items-baseline gap-2 mb-1">
            <span class="text-sm font-medium">{c.author_display_name || c.author_email}</span>
            <span class="text-xs text-[var(--color-muted-foreground)]">{formatDate(c.created_at)}</span>
            {#if href}
              <a
                {href}
                class="ml-auto text-xs text-[var(--color-info)] hover:underline shrink-0"
              >
                {targetLabel(c.target_kind)} →
              </a>
            {/if}
          </div>
          <p class="text-sm text-[var(--color-foreground)] whitespace-pre-wrap line-clamp-3">{c.body_md}</p>
        </li>
      {/each}
    </ul>
  </div>
{/if}
