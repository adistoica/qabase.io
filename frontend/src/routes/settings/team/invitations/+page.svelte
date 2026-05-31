<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Team, TeamInvitation } from '$lib/api';
  import type { TeamRole } from '$lib/permissions';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/toast-store';
  import { Copy, X } from '@lucide/svelte';

  let teams: Team[] = [];
  let selectedTeam: Team | null = null;
  let invitations: TeamInvitation[] = [];
  let loading = true;
  let invLoading = false;
  let sending = false;

  let inviteEmail = '';
  let inviteRole: TeamRole = 'member';
  let lastInviteUrl = '';

  async function load() {
    loading = true;
    try {
      teams = await api.get<Team[]>('/teams');
      const admins = teams.filter((t) => t.my_role === 'owner' || t.my_role === 'admin');
      if (admins.length > 0) await selectTeam(admins[0]);
      else if (teams.length > 0) await selectTeam(teams[0]);
    } finally {
      loading = false;
    }
  }

  async function selectTeam(t: Team) {
    selectedTeam = t;
    invitations = [];
    lastInviteUrl = '';
    if (t.my_role === 'owner' || t.my_role === 'admin') {
      invLoading = true;
      try {
        invitations = await api.get<TeamInvitation[]>(`/teams/${t.slug}/invitations`);
      } finally {
        invLoading = false;
      }
    }
  }

  async function sendInvite() {
    if (!selectedTeam || !inviteEmail.trim()) return;
    sending = true;
    lastInviteUrl = '';
    try {
      const result = await api.post<TeamInvitation & { invite_url: string }>(
        `/teams/${selectedTeam.slug}/invitations`,
        { email: inviteEmail.trim(), role: inviteRole },
        { silent: true }
      );
      invitations = [result, ...invitations];
      lastInviteUrl = `${window.location.origin}${result.invite_url}`;
      inviteEmail = '';
      toast.success('Invitation created.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to send invitation');
    } finally {
      sending = false;
    }
  }

  async function revokeInvite(inv: TeamInvitation) {
    if (!selectedTeam) return;
    try {
      await api.del(`/teams/${selectedTeam.slug}/invitations/${inv.id}`, { silent: true });
      invitations = invitations.filter((i) => i.id !== inv.id);
      toast.success('Invitation revoked.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to revoke');
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied.');
  }

  $: canManage = selectedTeam?.my_role === 'owner' || selectedTeam?.my_role === 'admin';

  onMount(load);
</script>

<PageHeader title="Invitations" subtitle="Invite people to join your team." />

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if teams.length === 0}
  <div class="text-sm text-[var(--color-muted-foreground)]">
    No teams yet. <a href="/settings/team" class="underline">Create a team</a> first.
  </div>
{:else}
  <div class="space-y-6">
    {#if teams.length > 1}
      <div class="flex gap-2 flex-wrap">
        {#each teams as t}
          <button
            type="button"
            on:click={() => selectTeam(t)}
            class="px-3 py-1.5 rounded-md text-sm transition-colors
              {selectedTeam?.id === t.id
                ? 'bg-[var(--color-accent)] font-medium'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
          >
            {t.name}
          </button>
        {/each}
      </div>
    {/if}

    {#if canManage}
      <div class="card p-5">
        <h2 class="font-semibold mb-4">Send invitation</h2>
        <div class="flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            class="input flex-1"
            placeholder="colleague@example.com"
            bind:value={inviteEmail}
          />
          <select class="input sm:w-40" bind:value={inviteRole}>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            class="btn btn-primary"
            disabled={sending || !inviteEmail.trim()}
            on:click={sendInvite}
          >
            {sending ? 'Sending…' : 'Send invite'}
          </button>
        </div>

        {#if lastInviteUrl}
          <div class="mt-4 p-3 rounded-md bg-[var(--color-muted)] flex items-center gap-3">
            <span class="text-xs font-mono flex-1 truncate">{lastInviteUrl}</span>
            <button class="btn btn-ghost px-2" on:click={() => copyLink(lastInviteUrl)} title="Copy link">
              <Copy size={14} />
            </button>
          </div>
          <p class="text-xs text-[var(--color-muted-foreground)] mt-2">
            Copy and share this link with the invitee. It expires in 7 days.
          </p>
        {/if}
      </div>

      <div class="card overflow-hidden">
        <div class="px-4 py-3 border-b">
          <h2 class="font-semibold text-sm">Pending invitations</h2>
        </div>
        {#if invLoading}
          <div class="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">Loading…</div>
        {:else if invitations.length === 0}
          <div class="px-4 py-6 text-sm text-[var(--color-muted-foreground)]">No pending invitations.</div>
        {:else}
          <table class="w-full text-sm">
            <thead class="border-b text-xs text-[var(--color-muted-foreground)] uppercase">
              <tr class="text-left">
                <th class="px-4 py-3">Email</th>
                <th class="px-4 py-3">Role</th>
                <th class="px-4 py-3">Expires</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each invitations as inv}
                <tr class="border-t hover:bg-[var(--color-muted)]/30">
                  <td class="px-4 py-3">{inv.email}</td>
                  <td class="px-4 py-3 capitalize">{inv.role}</td>
                  <td class="px-4 py-3 text-[var(--color-muted-foreground)] text-xs">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      class="btn btn-ghost text-xs px-2"
                      on:click={() => revokeInvite(inv)}
                      title="Revoke invitation"
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {:else}
      <div class="text-sm text-[var(--color-muted-foreground)]">
        You need admin or owner role to manage invitations.
      </div>
    {/if}
  </div>
{/if}
