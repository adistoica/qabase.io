<script lang="ts">
  import { api } from '$lib/api';
  import { currentUser } from '$lib/auth-store';
  import PageHeader from '$lib/components/PageHeader.svelte';
  import ThemePicker from '$lib/components/ThemePicker.svelte';

  // password change
  let curPw = '', nextPw = '', confirmPw = '', pwMsg = '', pwSaving = false;

  async function changePassword() {
    pwMsg = '';
    if (nextPw !== confirmPw) { pwMsg = 'Passwords do not match'; return; }
    pwSaving = true;
    try {
      await api.post('/auth/change-password', { current_password: curPw, new_password: nextPw });
      pwMsg = 'Password updated.';
      curPw = nextPw = confirmPw = '';
    } catch (e: any) {
      pwMsg = e?.detail || 'Failed';
    } finally { pwSaving = false; }
  }
</script>

<PageHeader title="Account" subtitle="Your profile, appearance and security settings." />

<div class="space-y-6">
  <!-- Appearance -->
  <div class="card p-5">
    <h2 class="font-semibold mb-4">Appearance</h2>
    <ThemePicker inline />
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Profile -->
    <div class="card p-5">
      <h2 class="font-semibold mb-3">Profile</h2>
      {#if $currentUser}
        <dl class="text-sm space-y-2">
          <div class="flex justify-between">
            <dt class="text-[var(--color-muted-foreground)]">Email</dt>
            <dd>{$currentUser.email}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-[var(--color-muted-foreground)]">Name</dt>
            <dd>{$currentUser.display_name}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-[var(--color-muted-foreground)]">Roles</dt>
            <dd>{$currentUser.roles.join(', ')}</dd>
          </div>
        </dl>
      {/if}
    </div>

    <!-- Change password -->
    <div class="card p-5">
      <h2 class="font-semibold mb-3">Change password</h2>
      <form on:submit|preventDefault={changePassword} class="space-y-3">
        <input type="password" class="input" placeholder="Current password" bind:value={curPw} required />
        <input type="password" class="input" placeholder="New password (≥ 8 chars)" bind:value={nextPw} minlength="8" required />
        <input type="password" class="input" placeholder="Confirm new password" bind:value={confirmPw} minlength="8" required />
        {#if pwMsg}<div class="text-xs text-[var(--color-muted-foreground)]">{pwMsg}</div>{/if}
        <button class="btn btn-primary" type="submit" disabled={pwSaving}>
          {pwSaving ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  </div>
</div>
