<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { currentUser } from '$lib/auth-store';
  import { get } from 'svelte/store';

  interface InviteDetails {
    id: string;
    email: string;
    role: string;
    expires_at: string;
    team: { id: string; name: string; slug: string };
    invited_by: string;
  }

  let invite: InviteDetails | null = null;
  let error = '';
  let loading = true;
  let accepting = false;
  let accepted = false;

  const token = $page.params.token;

  async function loadInvite() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`/api/invitations/${token}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        error = j.message || (res.status === 410 ? 'This invitation is no longer valid.' : 'Invitation not found.');
        return;
      }
      invite = await res.json();
    } catch {
      error = 'Failed to load invitation.';
    } finally {
      loading = false;
    }
  }

  async function acceptInvite() {
    const user = get(currentUser);
    if (!user) {
      await goto(`/login?redirect=/invite/${token}`);
      return;
    }
    accepting = true;
    error = '';
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`
        }
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        error = j.message || 'Failed to accept invitation.';
        return;
      }
      accepted = true;
      setTimeout(() => goto('/settings/team'), 2000);
    } catch {
      error = 'Failed to accept invitation.';
    } finally {
      accepting = false;
    }
  }

  onMount(loadInvite);
</script>

<svelte:head>
  <title>Team Invitation — QABase</title>
</svelte:head>

<div class="min-h-screen grid place-items-center bg-[var(--color-background)]">
  <div class="w-full max-w-md px-4">
    <div class="card p-8 text-center space-y-6">
      <div class="w-14 h-14 rounded-2xl bg-[var(--color-info)]/15 grid place-items-center mx-auto">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--color-info)]">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
      </div>

      {#if loading}
        <div class="text-sm text-[var(--color-muted-foreground)]">Loading invitation…</div>
      {:else if error}
        <div>
          <h1 class="text-xl font-semibold mb-2">Invitation unavailable</h1>
          <p class="text-sm text-[var(--color-muted-foreground)]">{error}</p>
          <a href="/" class="btn btn-outline mt-4 inline-block">Go home</a>
        </div>
      {:else if accepted}
        <div>
          <h1 class="text-xl font-semibold mb-2">Welcome to the team!</h1>
          <p class="text-sm text-[var(--color-muted-foreground)]">
            You've joined <strong>{invite?.team.name}</strong>. Redirecting…
          </p>
        </div>
      {:else if invite}
        <div>
          <h1 class="text-xl font-semibold">You're invited!</h1>
          <p class="text-sm text-[var(--color-muted-foreground)] mt-2">
            <strong>{invite.invited_by}</strong> has invited you to join
          </p>
          <div class="my-4 p-4 rounded-lg bg-[var(--color-muted)]">
            <div class="text-lg font-bold">{invite.team.name}</div>
            <div class="text-sm text-[var(--color-muted-foreground)] capitalize mt-1">
              as <strong>{invite.role}</strong>
            </div>
          </div>
          <p class="text-xs text-[var(--color-muted-foreground)]">
            Sent to: {invite.email} · Expires {new Date(invite.expires_at).toLocaleDateString()}
          </p>

          <button
            class="btn btn-primary w-full mt-6"
            disabled={accepting}
            on:click={acceptInvite}
          >
            {accepting ? 'Accepting…' : 'Accept invitation'}
          </button>

          {#if !$currentUser}
            <p class="text-xs text-[var(--color-muted-foreground)] mt-3">
              You'll need to sign in or create an account to accept.
            </p>
          {/if}

          {#if error}
            <div class="text-sm text-red-600 dark:text-red-400 mt-3">{error}</div>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>
