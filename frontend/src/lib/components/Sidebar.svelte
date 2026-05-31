<script lang="ts">
  import { page } from '$app/stores';
  import {
    LayoutDashboard,
    ListChecks,
    Library,
    Recycle,
    BookCheck,
    PlayCircle,
    Flag,
    Calendar,
    Link2,
    Inbox,
    Compass,
    History,
    Bug,
    Globe,
    Layers2,
    Plus,
    X,
    ChevronDown,
    ChevronLeft,
    PanelLeftClose,
  } from '@lucide/svelte';
  import { slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { sidebarOpen, sidebarCollapsed } from '$lib/ui-store';
  import { activeProject, projects } from '$lib/project-store';

  type Item = { path: string; label: string; icon: any };
  type Section = { title: string; items: Item[] };

  const sections: Section[] = [
    {
      title: 'Tests',
      items: [
        { path: 'repository',   label: 'Repository',     icon: Library },
        { path: 'cases',        label: 'Cases list',     icon: ListChecks },
        { path: 'steps',        label: 'Shared steps',   icon: Recycle },
        { path: 'suites',       label: 'Suites',         icon: Layers2 },
        { path: 'review',       label: 'Review',         icon: BookCheck },
        { path: 'requirements', label: 'Requirements',   icon: Link2 },
      ],
    },
    {
      title: 'Execution',
      items: [
        { path: 'plans',        label: 'Test plans',     icon: Calendar },
        { path: 'runs',         label: 'Test runs',      icon: PlayCircle },
        { path: 'queue',        label: 'My queue',       icon: Inbox },
        { path: 'exploratory',  label: 'Exploratory',    icon: Compass },
        { path: 'environments', label: 'Environments',   icon: Globe },
      ],
    },
    {
      title: 'Insights',
      items: [
        { path: '',      label: 'Dashboard', icon: LayoutDashboard },
        { path: 'audit', label: 'Audit log', icon: History },
      ],
    },
    {
      title: 'Issues',
      items: [
        { path: 'defects',    label: 'Defects',    icon: Bug },
        { path: 'milestones', label: 'Milestones', icon: Flag },
      ],
    },
  ];

  let collapsed: Record<string, boolean> = {};
  let switcherOpen = false;

  function toggle(title: string) { collapsed = { ...collapsed, [title]: !collapsed[title] }; }
  function closeDrawer() { sidebarOpen.set(false); }

  function href(path: string): string {
    const slug = $activeProject?.slug;
    if (!slug) return '/';
    return path ? `/${slug}/${path}` : `/${slug}/`;
  }

  function isActive(path: string): boolean {
    const h = href(path);
    const current = $page.url.pathname;
    if (!path) return current === h || current === `${h.replace(/\/$/, '')}`;
    return current === h || current.startsWith(`${h}/`);
  }

  function switchProject(slug: string) {
    switcherOpen = false;
    goto(`/${slug}/`);
  }
</script>

{#if $sidebarOpen}
  <div class="fixed inset-0 bg-black/40 z-40 md:hidden" on:click={closeDrawer} aria-hidden="true"></div>
{/if}

<aside
  class="shrink-0 border-r flex flex-col bg-[var(--color-card)] fixed md:static inset-y-0 left-0 z-50
    transition-[width,transform] duration-200 ease-in-out
    {$sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    {$sidebarCollapsed ? 'w-56 md:w-0 md:overflow-hidden md:border-r-0' : 'w-56'}"
>
  <!-- Project badge / switcher -->
  <div class="px-3 py-3 border-b relative">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex items-center gap-2 min-w-0 flex-1 rounded-md hover:bg-[var(--color-muted)] px-1 py-1 -mx-1 text-left"
        on:click={() => (switcherOpen = !switcherOpen)}
        aria-label="Switch project"
      >
        <span class="grid place-items-center w-6 h-6 rounded text-[10px] font-semibold uppercase shrink-0 bg-[var(--color-info)]/15 text-[var(--color-info)]">
          {$activeProject?.code_prefix?.slice(0, 2) || 'TP'}
        </span>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-semibold truncate leading-tight">{$activeProject?.name || 'No project'}</div>
          <div class="text-[10px] text-[var(--color-muted-foreground)] truncate">{$activeProject?.slug || ''}</div>
        </div>
        <ChevronDown size={13} class="shrink-0 text-[var(--color-muted-foreground)]" />
      </button>
      <button class="md:hidden btn btn-ghost px-2 shrink-0" on:click={closeDrawer} aria-label="Close menu">
        <X size={16} />
      </button>
    </div>

    {#if switcherOpen}
      <div class="absolute left-3 right-3 top-full mt-1 card z-30 overflow-hidden shadow-lg" role="menu">
        {#each $projects as p}
          <button
            type="button"
            class="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-muted)] {p.id === $activeProject?.id ? 'bg-[var(--color-accent)]' : ''}"
            on:click={() => switchProject(p.slug)}
          >
            <div class="font-medium">{p.name}</div>
            <div class="text-xs text-[var(--color-muted-foreground)]">{p.slug}</div>
          </button>
        {/each}
        <hr class="border-[var(--color-border)] my-1" />
        <a
          href="/projects"
          on:click={() => { switcherOpen = false; closeDrawer(); }}
          class="flex items-center gap-2 w-full px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        >
          <Plus size={13} /> New project
        </a>
      </div>
    {/if}
  </div>

  <!-- Nav sections -->
  <nav class="flex-1 px-2 py-3 overflow-y-auto space-y-4">
    {#each sections as section}
      {@const isCollapsed = collapsed[section.title]}
      <div>
        <button
          type="button"
          class="w-full flex items-center justify-between px-2 py-0.5 mb-1 text-[10px] font-semibold tracking-widest uppercase text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          on:click={() => toggle(section.title)}
        >
          <span>{section.title}</span>
          {#if isCollapsed}
            <ChevronLeft size={11} />
          {:else}
            <ChevronDown size={11} />
          {/if}
        </button>
        {#if !isCollapsed}
          <ul class="space-y-0.5" transition:slide={{ duration: 150 }}>
            {#each section.items as it}
              {@const active = isActive(it.path)}
              <li>
                <a
                  href={href(it.path)}
                  on:click={closeDrawer}
                  class="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors
                    {active
                      ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium'
                      : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'}"
                >
                  <svelte:component this={it.icon} size={15} />
                  <span class="truncate">{it.label}</span>
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/each}
  </nav>

  <!-- Collapse sidebar button -->
  <div class="border-t px-2 py-2">
    <button
      type="button"
      on:click={() => { sidebarCollapsed.set(true); closeDrawer(); }}
      class="hidden md:flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
    >
      <PanelLeftClose size={15} /> Collapse submenu
    </button>
  </div>
</aside>
