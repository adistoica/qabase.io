<script lang="ts">
  import '../app.css';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import ModalHost from '$lib/components/ModalHost.svelte';
  import ToastHost from '$lib/components/ToastHost.svelte';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';
  import { currentUser } from '$lib/auth-store';
  import { activeProjectId, projects } from '$lib/project-store';
  import { themeSettings } from '$lib/theme-store';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import type { Project, User } from '$lib/api';

  $: hideSidebar = $page.url.pathname === '/projects' || $page.url.pathname.startsWith('/admin');

  let loading = true;

  onMount(async () => {
    themeSettings.update((s) => s);
    try {
      const me = await api.get<User>('/auth/me');
      currentUser.set(me);
      const ps = await api.get<Project[]>('/projects');
      projects.set(ps);
      const path = $page.url.pathname;
      if (ps.length === 0) {
        await goto('/projects', { replaceState: true });
      } else if (path === '/') {
        await goto(`/${ps[0].slug}/`, { replaceState: true });
      }
    } catch {
      currentUser.set(null);
      await supabase.auth.signOut();
      const path = $page.url.pathname;
      if (path !== '/login' && !path.startsWith('/public/') && !path.startsWith('/invite/')) {
        await goto('/login');
      }
    } finally {
      loading = false;
    }
  });
</script>

<ModalHost />
<ToastHost />

{#if loading}
  <div class="min-h-screen grid place-items-center">
    <div class="flex flex-col items-center gap-3">
      <div class="w-12 h-12 rounded-2xl bg-[var(--color-info)]/15 grid place-items-center animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--color-info)]"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>
      </div>
      <span class="font-semibold tracking-tight">QABase.io</span>
      <span class="text-xs text-[var(--color-muted-foreground)]">Loading…</span>
    </div>
  </div>
{:else if !$currentUser || $page.url.pathname === '/login' || $page.url.pathname.startsWith('/public/') || $page.url.pathname.startsWith('/invite/')}
  <slot />
{:else}
  <div class="min-h-screen flex flex-col">
    <TopBar />
    <div class="flex flex-1 min-h-0">
      {#if !hideSidebar}
        <Sidebar />
      {/if}
      <main class="flex-1 min-w-0 overflow-y-auto bg-[var(--color-background)] p-4 md:p-6">
        <slot />
      </main>
    </div>
  </div>
{/if}
