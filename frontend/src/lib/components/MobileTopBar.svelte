<script lang="ts">
  import { Menu, Rocket } from '@lucide/svelte';
  import { sidebarOpen } from '$lib/ui-store';
</script>

<header class="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b bg-[var(--color-card)] px-3 py-2.5">
  <button
    type="button"
    class="btn btn-ghost px-2"
    aria-label="Open menu"
    on:click={() => sidebarOpen.update((v) => !v)}
  >
    <Menu size={20} />
  </button>
  <div class="flex items-center gap-2">
    <Rocket size={18} class="text-[var(--color-info)]" />
    <span class="font-semibold tracking-tight">QABase.io</span>
  </div>
</header>
