<script lang="ts">
  import { ArrowUp, ArrowDown, ArrowRight } from '@lucide/svelte';
  export let priority: string = 'P2';

  $: cfg = {
    P0: { Icon: ArrowUp, color: 'var(--color-destructive)', title: 'P0 — critical' },
    P1: { Icon: ArrowUp, color: 'var(--color-warning)', title: 'P1 — high' },
    P2: { Icon: ArrowRight, color: 'var(--color-muted-foreground)', title: 'P2 — medium' },
    P3: { Icon: ArrowDown, color: 'var(--color-info)', title: 'P3 — low' },
  }[priority] || { Icon: ArrowRight, color: 'var(--color-muted-foreground)', title: priority };
</script>

<span title={cfg.title} style="color: {cfg.color}" class="inline-flex items-center">
  <svelte:component this={cfg.Icon} size={14} />
</span>
