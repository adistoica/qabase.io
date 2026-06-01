<script lang="ts">
  import { Bell, MessageSquare, Menu, Rocket, PanelLeft, LogOut } from '@lucide/svelte';
  import { sidebarOpen, sidebarCollapsed } from '$lib/ui-store';
  import { currentUser } from '$lib/auth-store';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { page } from '$app/stores';
  import ThemeToggle from './ThemeToggle.svelte';

  $: isWorkspace = $page.url.pathname === '/workspace' || $page.url.pathname.startsWith('/workspace/');
  $: isProjects = $page.url.pathname === '/projects';

  let userMenuOpen = false;

  async function logout() {
    userMenuOpen = false;
    currentUser.set(null);
    await supabase.auth.signOut();
    goto('/login');
  }

  function closeMenu() { userMenuOpen = false; }

  $: initial = (($currentUser?.display_name || $currentUser?.email || 'U') + '').trim()[0]?.toUpperCase() ?? 'U';
</script>

<svelte:window on:click={(e) => {
  if (userMenuOpen && !(e.target as Element)?.closest('[data-user-menu]')) userMenuOpen = false;
}} />

<header class="sticky top-0 z-30 h-12 flex items-center gap-2 px-3 md:px-4 border-b bg-[var(--color-card)]">
  <!-- Mobile hamburger -->
  <button
    type="button"
    class="md:hidden btn btn-ghost px-2"
    aria-label="Open menu"
    on:click={() => sidebarOpen.update((v) => !v)}
  >
    <Menu size={18} />
  </button>

  <!-- Desktop: expand sidebar button (only when collapsed) -->
  {#if $sidebarCollapsed}
    <button
      type="button"
      class="hidden md:flex btn btn-ghost px-2"
      aria-label="Expand sidebar"
      on:click={() => sidebarCollapsed.set(false)}
    >
      <PanelLeft size={18} />
    </button>
  {/if}

  <!-- Logo -->
  <a href="/" class="flex items-center gap-2 shrink-0" aria-label="QABase.io home">
    <span class="grid place-items-center w-7 h-7 rounded-md bg-[var(--color-info)]/15 text-[var(--color-info)]">
      <Rocket size={14} />
    </span>
    <span class="hidden sm:inline font-semibold text-sm tracking-tight">QABase.io</span>
  </a>

  <!-- Top-level nav -->
  <nav class="hidden md:flex items-center gap-1 ml-2">
    <a
      href="/projects"
      class="px-3 py-1 rounded-md text-[13px] transition-colors
        {isProjects
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium'
          : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'}"
    >
      Projects
    </a>
    <a
      href="/workspace"
      class="px-3 py-1 rounded-md text-[13px] transition-colors
        {isWorkspace
          ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium'
          : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'}"
    >
      Workspace
    </a>
  </nav>

  <div class="flex-1"></div>

  <!-- Right actions -->
  <button type="button" class="btn btn-ghost px-2" aria-label="Notifications">
    <Bell size={17} />
  </button>
  <button type="button" class="btn btn-ghost px-2" aria-label="Messages">
    <MessageSquare size={17} />
  </button>

  <!-- User avatar menu -->
  <div class="relative" data-user-menu>
    <button
      type="button"
      class="grid place-items-center w-7 h-7 rounded-full bg-[var(--color-info)]/20 text-[var(--color-info)] text-xs font-semibold hover:bg-[var(--color-info)]/30 transition-colors"
      aria-label="User menu"
      on:click|stopPropagation={() => (userMenuOpen = !userMenuOpen)}
    >
      {initial}
    </button>

    {#if userMenuOpen}
      <div
        class="absolute right-0 top-full mt-2 w-52 card shadow-lg z-50 overflow-hidden"
        role="menu"
        on:click|stopPropagation
      >
        <!-- User info -->
        {#if $currentUser}
          <div class="px-3 py-2.5 border-b">
            <div class="text-xs font-medium truncate">{$currentUser.display_name || $currentUser.email}</div>
            {#if $currentUser.display_name}
              <div class="text-[11px] text-[var(--color-muted-foreground)] truncate">{$currentUser.email}</div>
            {/if}
          </div>
        {/if}

        <!-- Theme toggle -->
        <div class="px-3 py-2 border-b flex items-center gap-2">
          <span class="text-xs text-[var(--color-muted-foreground)]">Theme</span>
          <ThemeToggle />
        </div>

        <div class="border-t py-1">
          <button
            type="button"
            on:click={logout}
            class="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    {/if}
  </div>
</header>
