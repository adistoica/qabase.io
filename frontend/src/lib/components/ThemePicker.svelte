<script lang="ts">
  import { Sun, Moon, Monitor } from '@lucide/svelte';
  import {
    themeSettings, colorMeta, modeLabel,
    COLORS, MODES,
    type ColorScheme, type ThemeMode,
  } from '$lib/theme-store';

  export let inline = false;

  let open = false;
  let wrapper: HTMLElement;

  function setColor(c: ColorScheme) {
    themeSettings.update((s) => ({ ...s, color: c }));
  }

  function setMode(m: ThemeMode) {
    themeSettings.update((s) => ({ ...s, mode: m }));
  }

  function handleWindowClick(e: MouseEvent) {
    if (!open || inline) return;
    if (wrapper && !wrapper.contains(e.target as Node)) open = false;
  }

  const modeIcon: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };
</script>

<svelte:window on:click={handleWindowClick} />

<div bind:this={wrapper} class="relative">
  {#if !inline}
    <!-- Trigger button -->
    <button
      type="button"
      on:click|stopPropagation={() => (open = !open)}
      class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      title="Change theme"
    >
      <span
        class="w-4 h-4 rounded-full ring-2 ring-offset-1 ring-[var(--color-border)] shrink-0"
        style="background: {colorMeta[$themeSettings.color].swatch};"
      ></span>
      <span class="flex-1 text-left">Theme</span>
      <svelte:component this={modeIcon[$themeSettings.mode]} size={14} />
    </button>
  {/if}

  <!-- Panel (popover or inline) -->
  {#if open || inline}
    <div
      class="{inline
        ? ''
        : 'absolute bottom-full left-0 mb-2 shadow-lg z-50'} w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 space-y-3"
      on:click|stopPropagation
    >
      <!-- Color swatches -->
      <div>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2 font-medium">Color</div>
        <div class="flex gap-2 flex-wrap">
          {#each COLORS as c}
            {@const active = $themeSettings.color === c}
            <button
              type="button"
              title={colorMeta[c].label}
              on:click={() => setColor(c)}
              class="w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none {active ? 'ring-2 ring-offset-2 ring-[var(--color-foreground)]' : ''}"
              style="background: {colorMeta[c].swatch};"
            ></button>
          {/each}
        </div>
        <!-- Color label -->
        <div class="mt-1.5 text-xs text-[var(--color-muted-foreground)]">
          {colorMeta[$themeSettings.color].label}
        </div>
      </div>

      <!-- Mode buttons -->
      <div>
        <div class="text-[10px] uppercase tracking-wider text-[var(--color-muted-foreground)] mb-2 font-medium">Mode</div>
        <div class="flex gap-1">
          {#each MODES as m}
            {@const active = $themeSettings.mode === m}
            <button
              type="button"
              on:click={() => setMode(m)}
              class="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors {active
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]'}"
            >
              <svelte:component this={modeIcon[m]} size={12} />
              {modeLabel[m]}
            </button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
