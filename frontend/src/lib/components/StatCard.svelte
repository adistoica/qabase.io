<script lang="ts">
  export let label: string;
  export let value: string | number;
  export let hint: string = '';
</script>

<div class="card p-5">
  <div class="text-sm text-[var(--color-muted-foreground)]">{label}</div>
  <div class="text-3xl font-semibold mt-2 tracking-tight">{value}</div>
  {#if hint}
    <div class="text-xs text-[var(--color-muted-foreground)] mt-2">{hint}</div>
  {/if}
</div>
