<script lang="ts">
  import { page } from '$app/stores';
  import { Bell, MessageSquare, Menu, Rocket, PanelLeft, Settings, Users, LogOut } from '@lucide/svelte';
  import { sidebarOpen, sidebarCollapsed } from '$lib/ui-store';
  import { currentUser } from '$lib/auth-store';
  import { activeProject } from '$lib/project-store';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import ThemeToggle from './ThemeToggle.svelte';

  const navItems = [
    { label: 'Projects',  path: null,      segments: ['projects'] },
  ];

  $: slug = $activeProject?.slug ?? null;

  let userMenuOpen = false;

  function navHref(item: (typeof navItems)[0]): string {
    if (item.path === null) return '/projects';
    if (!slug) return '/projects';
    return item.path ? `/${slug}/${item.path}` : `/${slug}/`;
  }

  function isActive(item: (typeof navItems)[0]): boolean {
    const current = $page.url.pathname;
    if (item.path === null) return current === '/projects';
    if (!slug) return false;
    return item.segments.some((seg) => {
      if (seg === '') return current === `/${slug}/` || current === `/${slug}`;
      return current === `/${slug}/${seg}` || current.startsWith(`/${slug}/${seg}/`);
    });
  }

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

  <!-- Divider -->
  <div class="hidden md:block h-5 w-px bg-[var(--color-border)] mx-1"></div>

  <!-- Main nav -->
  <nav class="hidden md:flex items-center overflow-x-auto gap-2">
    {#each navItems as item}
      {@const active = isActive(item)}
      <a
        href={navHref(item)}
        class="relative px-3 h-12 flex items-center text-sm whitespace-nowrap transition-colors
          {active
            ? 'text-[var(--color-foreground)] font-semibold after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-[var(--color-info)] hover:opacity-80'
            : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
      >
        {item.label}
      </a>
    {/each}
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

        <!-- Nav items -->
        <div class="py-1">
          <a
            href="/settings"
            on:click={closeMenu}
            class="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <Settings size={14} /> Settings
          </a>
          <a
            href="/settings/team"
            on:click={closeMenu}
            class="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          >
            <Users size={14} /> Team
          </a>
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
