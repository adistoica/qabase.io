<script lang="ts">
  export let title: string;
  export let subtitle: string = '';
</script>

<div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3 md:gap-4 pb-6 mb-6 border-b">
  <div class="min-w-0">
    <h1 class="text-xl md:text-2xl font-semibold tracking-tight truncate">{title}</h1>
    {#if subtitle}
      <p class="text-sm text-[var(--color-muted-foreground)] mt-1">{subtitle}</p>
    {/if}
  </div>
  <div class="flex items-center flex-wrap gap-2 shrink-0">
    <slot name="actions" />
  </div>
</div>
