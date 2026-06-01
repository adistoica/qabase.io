<script lang="ts">
  import { page } from '$app/stores';
  import { LayoutDashboard, Users, Users2, Settings, History, Mail } from '@lucide/svelte';
  import type { ComponentType, SvelteComponent } from 'svelte';

  type Item = { path: string; label: string; icon: ComponentType<SvelteComponent> };
  type Section = { title: string; items: Item[] };

  const sections: Section[] = [
    {
      title: 'Workspace',
      items: [
        { path: '/workspace',          label: 'Overview', icon: LayoutDashboard },
        { path: '/workspace/members',  label: 'Members',  icon: Users },
        { path: '/workspace/settings', label: 'Settings', icon: Settings },
      ],
    },
    {
      title: 'Team',
      items: [
        { path: '/settings/team',              label: 'Team Settings', icon: Users2 },
        { path: '/settings/team/members',      label: 'Members',       icon: Users },
        { path: '/settings/team/invitations',  label: 'Invitations',   icon: Mail },
      ],
    },
    {
      title: 'Insights',
      items: [
        { path: '/workspace/audit', label: 'Audit log', icon: History },
      ],
    },
  ];

  function isActive(item: Item): boolean {
    const current = $page.url.pathname;
    if (item.path === '/workspace' || item.path === '/settings/team') return current === item.path;
    return current === item.path || current.startsWith(item.path + '/');
  }
</script>

<aside
  class="shrink-0 w-56 border-r flex flex-col bg-[var(--color-card)]
    fixed md:static inset-y-0 left-0 z-50 md:translate-x-0"
>
  <!-- Header -->
  <div class="px-3 py-3 border-b">
    <div class="flex items-center gap-2 px-1 py-1">
      <span class="grid place-items-center w-6 h-6 rounded text-[10px] font-semibold uppercase shrink-0 bg-[var(--color-info)]/15 text-[var(--color-info)]">
        W
      </span>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-semibold truncate leading-tight">Workspace</div>
      </div>
    </div>
  </div>

  <!-- Nav sections -->
  <nav class="flex-1 px-2 py-3 overflow-y-auto space-y-4">
    {#each sections as section}
      <div>
        <div class="px-2 py-0.5 mb-1 text-[10px] font-semibold tracking-widest uppercase text-[var(--color-muted-foreground)]">
          {section.title}
        </div>
        <ul class="space-y-0.5">
          {#each section.items as item}
            {@const active = isActive(item)}
            <li>
              <a
                href={item.path}
                class="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors
                  {active
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)] font-medium'
                    : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'}"
              >
                <svelte:component this={item.icon} size={15} />
                <span class="truncate">{item.label}</span>
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>
</aside>
