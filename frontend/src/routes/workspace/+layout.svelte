<script lang="ts">
  import WorkspaceSidebar from '$lib/components/WorkspaceSidebar.svelte';
</script>

<WorkspaceSidebar />
<main class="flex-1 min-w-0 overflow-y-auto bg-[var(--color-background)] p-4 md:p-6">
  <slot />
</main>
