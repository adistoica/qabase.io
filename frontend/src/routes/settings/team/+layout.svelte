<script lang="ts">
  import { page } from '$app/stores';
  import WorkspaceSidebar from '$lib/components/WorkspaceSidebar.svelte';

  const tabs = [
    { href: '/settings/team', label: 'Team Settings' },
    { href: '/settings/team/members', label: 'Members' },
    { href: '/settings/team/invitations', label: 'Invitations' },
  ];
</script>

<div class="flex flex-1 min-h-0">
  <WorkspaceSidebar />
  <main class="flex-1 min-w-0 overflow-y-auto bg-[var(--color-background)] p-4 md:p-6">
    <div class="space-y-4">
      <nav class="flex gap-1 border-b pb-0">
        {#each tabs as tab}
          {@const active = $page.url.pathname === tab.href}
          <a
            href={tab.href}
            class="px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors
              {active
                ? 'border-[var(--color-info)] text-[var(--color-info)] font-medium'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'}"
          >
            {tab.label}
          </a>
        {/each}
      </nav>
      <slot />
    </div>
  </main>
</div>
