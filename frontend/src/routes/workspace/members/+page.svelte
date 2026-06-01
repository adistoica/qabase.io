<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { formatDate } from '$lib/format';

  interface Member {
    id: string;
    email: string;
    display_name: string;
    roles: string[];
    is_active: boolean;
    created_at: string;
  }

  let members: Member[] = [];
  let loading = true;

  onMount(async () => {
    try {
      members = await api.get<Member[]>('/workspace/members');
    } catch {
      members = [];
    } finally {
      loading = false;
    }
  });
</script>

<PageHeader title="Members" subtitle="All users in this workspace." />

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if members.length === 0}
  <div class="card p-12 text-center text-sm text-[var(--color-muted-foreground)]">No members found.</div>
{:else}
  <div class="card">
    <div class="table-wrap">
      <table class="w-full text-sm">
        <thead class="text-xs text-[var(--color-muted-foreground)] uppercase">
          <tr class="text-left">
            <th class="px-4 py-2">Name</th>
            <th class="px-4 py-2">Email</th>
            <th class="px-4 py-2">Roles</th>
            <th class="px-4 py-2">Joined</th>
            <th class="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each members as m}
            <tr class="border-t">
              <td class="px-4 py-2 font-medium">{m.display_name || '—'}</td>
              <td class="px-4 py-2 text-[var(--color-muted-foreground)]">{m.email}</td>
              <td class="px-4 py-2 text-xs">{m.roles?.join(', ') || '—'}</td>
              <td class="px-4 py-2 text-[var(--color-muted-foreground)]">{formatDate(m.created_at)}</td>
              <td class="px-4 py-2">
                <span class="text-xs px-2 py-0.5 rounded-full {m.is_active ? 'bg-[var(--color-success)]/15 text-[var(--color-success)]' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}">
                  {m.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
