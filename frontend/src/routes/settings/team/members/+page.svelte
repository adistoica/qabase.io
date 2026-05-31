<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import type { Team, TeamMember } from '$lib/api';
  import { canManageMembers } from '$lib/permissions';
  import type { TeamRole } from '$lib/permissions';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import { toast } from '$lib/toast-store';
  import { modal } from '$lib/modal-store';
  import { Trash2 } from '@lucide/svelte';

  let teams: Team[] = [];
  let selectedTeam: Team | null = null;
  let members: TeamMember[] = [];
  let loading = true;
  let membersLoading = false;

  const roleOptions: TeamRole[] = ['admin', 'member', 'viewer'];

  async function load() {
    loading = true;
    try {
      teams = await api.get<Team[]>('/teams');
      if (teams.length > 0) await selectTeam(teams[0]);
    } finally {
      loading = false;
    }
  }

  async function selectTeam(t: Team) {
    selectedTeam = t;
    membersLoading = true;
    try {
      members = await api.get<TeamMember[]>(`/teams/${t.slug}/members`);
    } finally {
      membersLoading = false;
    }
  }

  async function changeRole(member: TeamMember, newRole: TeamRole) {
    if (!selectedTeam) return;
    try {
      await api.patch(`/teams/${selectedTeam.slug}/members/${member.user.id}`, { role: newRole }, { silent: true });
      members = members.map((m) => (m.id === member.id ? { ...m, role: newRole } : m));
      toast.success('Role updated.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to update role');
    }
  }

  async function removeMember(member: TeamMember) {
    if (!selectedTeam) return;
    const confirmed = await modal.confirm(
      'Remove member',
      `Remove ${member.user.display_name || member.user.email} from the team?`
    );
    if (!confirmed) return;
    try {
      await api.del(`/teams/${selectedTeam.slug}/members/${member.user.id}`, { silent: true });
      members = members.filter((m) => m.id !== member.id);
      toast.success('Member removed.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to remove member');
    }
  }

  async function deactivateMember(member: TeamMember) {
    if (!selectedTeam) return;
    const confirmed = await modal.confirm(
      'Deactivate member',
      `Deactivate ${member.user.display_name || member.user.email}? They will lose access but remain in the member list.`
    );
    if (!confirmed) return;
    try {
      await api.post(`/teams/${selectedTeam.slug}/members/${member.user.id}/deactivate`, undefined, { silent: true });
      members = members.map((m) => (m.id === member.id ? { ...m, status: 'deactivated' } : m));
      toast.success('Member deactivated.');
    } catch (e: any) {
      toast.error(e?.detail || 'Failed to deactivate');
    }
  }

  $: canManage = selectedTeam ? canManageMembers(selectedTeam.my_role as TeamRole) : false;

  onMount(load);
</script>

<PageHeader title="Team Members" subtitle="Manage roles and access for team members." />

{#if loading}
  <div class="text-sm text-[var(--color-muted-foreground)]">Loading…</div>
{:else if teams.length === 0}
  <div class="text-sm text-[var(--color-muted-foreground)]">
    No teams yet. <a href="/settings/team" class="underline">Create a team</a> first.
  </div>
{:else}
  <div class="space-y-4">
    {#if teams.length > 1}
      <div class="flex gap-2">
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

    {#if membersLoading}
      <div class="text-sm text-[var(--color-muted-foreground)]">Loading members…</div>
    {:else if members.length === 0}
      <div class="text-sm text-[var(--color-muted-foreground)]">No members found.</div>
    {:else}
      <div class="card overflow-hidden">
        <table class="w-full text-sm">
          <thead class="border-b text-xs text-[var(--color-muted-foreground)] uppercase">
            <tr class="text-left">
              <th class="px-4 py-3">Member</th>
              <th class="px-4 py-3">Role</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Joined</th>
              {#if canManage}
                <th class="px-4 py-3 text-right">Actions</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each members as member}
              <tr class="border-t hover:bg-[var(--color-muted)]/30">
                <td class="px-4 py-3">
                  <div class="font-medium">{member.user.display_name || member.user.email}</div>
                  <div class="text-xs text-[var(--color-muted-foreground)]">{member.user.email}</div>
                </td>
                <td class="px-4 py-3">
                  {#if canManage && member.role !== 'owner'}
                    <select
                      class="input py-1 text-xs"
                      value={member.role}
                      on:change={(e) => changeRole(member, (e.target as HTMLSelectElement).value as TeamRole)}
                    >
                      {#each roleOptions as r}
                        <option value={r}>{r}</option>
                      {/each}
                    </select>
                  {:else}
                    <span class="capitalize">{member.role}</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span class="text-xs px-2 py-0.5 rounded-full
                    {member.status === 'active'
                      ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                      : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}">
                    {member.status}
                  </span>
                </td>
                <td class="px-4 py-3 text-[var(--color-muted-foreground)] text-xs">
                  {new Date(member.joined_at).toLocaleDateString()}
                </td>
                {#if canManage}
                  <td class="px-4 py-3 text-right">
                    {#if member.role !== 'owner'}
                      <div class="flex justify-end gap-1">
                        {#if member.status === 'active'}
                          <button
                            class="btn btn-ghost text-xs px-2"
                            on:click={() => deactivateMember(member)}
                          >
                            Deactivate
                          </button>
                        {/if}
                        <button
                          class="btn btn-ghost text-[var(--color-destructive)] px-2"
                          on:click={() => removeMember(member)}
                          title="Remove member"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    {/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
{/if}
