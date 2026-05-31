<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Review } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';
  import { currentUser } from '$lib/auth-store';
  import { CheckCircle, XCircle, Trash2 } from '@lucide/svelte';
  import { page } from '$app/stores';
  import { modal } from '$lib/modal-store';

  $: slug = $page.params.projectSlug;

  let tab: 'pending' | 'mine' = 'pending';
  let pending: Review[] = [];
  let mine: Review[] = [];
  let loading = true;

  let decideModal: { review: Review; action: 'approved' | 'rejected' } | null = null;
  let decideNote = '';
  let deciding = false;

  async function load() {
    loading = true;
    [pending, mine] = await Promise.all([
      api.get<Review[]>('/reviews?status=pending'),
      $currentUser ? api.get<Review[]>(`/reviews?submitted_by=${$currentUser.id}`) : Promise.resolve([]),
    ]);
    loading = false;
  }

  onMount(load);

  function openDecide(review: Review, action: 'approved' | 'rejected') {
    decideModal = { review, action };
    decideNote = '';
  }

  async function submitDecide() {
    if (!decideModal) return;
    deciding = true;
    try {
      await api.post(`/reviews/${decideModal.review.id}/decide`, {
        decision: decideModal.action,
        note: decideNote,
      });
      decideModal = null;
      await load();
    } catch {
      // error toast shown automatically
    } finally {
      deciding = false;
    }
  }

  async function cancel(id: string) {
    if (!await modal.confirm('Cancel review', 'This review request will be cancelled.', { confirmLabel: 'Cancel request' })) return;
    try {
      await api.del(`/reviews/${id}`);
      await load();
    } catch {
      // error toast shown automatically
    }
  }

  function statusBadge(s: string) {
    if (s === 'approved') return 'badge badge-success';
    if (s === 'rejected') return 'badge badge-destructive';
    return 'badge badge-info';
  }
</script>

<PageHeader title="Review Queue" />

<div class="p-4 space-y-4">
  <!-- Tabs -->
  <div class="flex gap-1 border-b">
    {#each [['pending', 'Pending'] , ['mine', 'My submissions']] as [val, label]}
      <button
        class="px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors {tab === val ? 'border-[var(--color-accent)] text-[var(--color-foreground)]' : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
        on:click={() => (tab = val)}
      >{label}</button>
    {/each}
  </div>

  {#if loading}
    <p class="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
  {:else}
    {@const rows = tab === 'pending' ? pending : mine}
    {#if rows.length === 0}
      <div class="card p-8 text-center text-[var(--color-muted-foreground)]">
        <p class="text-sm">{tab === 'pending' ? 'No pending reviews.' : 'You have no submissions.'}</p>
      </div>
    {:else}
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b text-xs text-[var(--color-muted-foreground)] uppercase tracking-wider">
              <th class="text-left px-4 py-2 font-medium">Case</th>
              <th class="text-left px-4 py-2 font-medium">Status</th>
              <th class="text-left px-4 py-2 font-medium">Submitted</th>
              {#if tab === 'pending'}
                <th class="text-left px-4 py-2 font-medium">Note</th>
              {:else}
                <th class="text-left px-4 py-2 font-medium">Reviewer note</th>
              {/if}
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as r (r.id)}
              <tr class="border-b last:border-0 hover:bg-[var(--color-muted)]/40">
                <td class="px-4 py-2.5">
                  <a href={`/${slug}/cases/${r.test_case_id}`} class="font-mono text-xs text-[var(--color-info)] mr-2">{r.case_code}</a>
                  <span class="font-medium">{r.case_title}</span>
                </td>
                <td class="px-4 py-2.5">
                  <span class={statusBadge(r.status)}>{r.status}</span>
                </td>
                <td class="px-4 py-2.5 text-xs text-[var(--color-muted-foreground)]">{formatDate(r.submitted_at)}</td>
                <td class="px-4 py-2.5 text-xs text-[var(--color-muted-foreground)] max-w-xs truncate">{r.note || '—'}</td>
                <td class="px-4 py-2.5">
                  <div class="flex gap-1 justify-end">
                    {#if tab === 'pending' && r.status === 'pending'}
                      <button class="btn btn-ghost btn-sm px-2 text-[var(--color-success)]" title="Approve" on:click={() => openDecide(r, 'approved')}>
                        <CheckCircle size={14} />
                      </button>
                      <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" title="Reject" on:click={() => openDecide(r, 'rejected')}>
                        <XCircle size={14} />
                      </button>
                    {/if}
                    {#if tab === 'mine' && r.status === 'pending'}
                      <button class="btn btn-ghost btn-sm px-2 text-[var(--color-destructive)]" title="Cancel" on:click={() => cancel(r.id)}>
                        <Trash2 size={13} />
                      </button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {/if}
</div>

<!-- Decide modal -->
{#if decideModal}
  <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" on:click|self={() => (decideModal = null)}>
    <div class="card w-full max-w-md p-6 space-y-4">
      <h2 class="font-semibold text-base capitalize">{decideModal.action} review</h2>
      <p class="text-sm text-[var(--color-muted-foreground)]">
        Case: <span class="font-medium text-[var(--color-foreground)]">{decideModal.review.case_title}</span>
      </p>
      <textarea
        class="input w-full h-24 resize-none"
        placeholder="Note (optional)"
        bind:value={decideNote}
      ></textarea>
      <div class="flex gap-2 justify-end">
        <button class="btn btn-ghost" on:click={() => (decideModal = null)}>Cancel</button>
        <button
          class="btn {decideModal.action === 'approved' ? 'btn-primary' : 'btn-destructive'}"
          on:click={submitDecide}
          disabled={deciding}
        >
          {deciding ? 'Submitting…' : decideModal.action === 'approved' ? 'Approve' : 'Reject'}
        </button>
      </div>
    </div>
  </div>
{/if}
