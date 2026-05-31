<script lang="ts">
  import { activeModal } from '$lib/modal-store';

  let inputValue = '';

  $: if ($activeModal?.type === 'prompt') {
    inputValue = $activeModal.defaultValue ?? '';
  }

  function resolve(value: boolean | string | null | undefined) {
    $activeModal?.resolve(value);
    activeModal.set(null);
    inputValue = '';
  }

  function onKey(e: KeyboardEvent) {
    if (!$activeModal) return;
    if (e.key === 'Escape') {
      if ($activeModal.type === 'confirm') resolve(false);
      else if ($activeModal.type === 'prompt') resolve(null);
      else resolve(undefined);
    }
  }

  function onConfirmClick() {
    if (!$activeModal) return;
    if ($activeModal.type === 'confirm') resolve(true);
    else if ($activeModal.type === 'prompt') resolve(inputValue);
    else resolve(undefined);
  }

  function onCancelClick() {
    if (!$activeModal) return;
    if ($activeModal.type === 'confirm') resolve(false);
    else resolve(null);
  }

  function focusInput(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $activeModal}
  {@const m = $activeModal}
  <div
    class="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
    on:click|self={onCancelClick}
    role="dialog"
    aria-modal="true"
  >
    <div class="card w-full max-w-sm p-6 space-y-4 shadow-xl">
      <h2 class="font-semibold text-base">{m.title}</h2>

      {#if m.message}
        <p class="text-sm text-[var(--color-muted-foreground)] whitespace-pre-wrap">{m.message}</p>
      {/if}

      {#if m.type === 'prompt'}
        <input
          class="input w-full"
          placeholder={m.placeholder}
          bind:value={inputValue}
          on:keydown={(e) => e.key === 'Enter' && onConfirmClick()}
          use:focusInput
        />
      {/if}

      <div class="flex justify-end gap-2 pt-1">
        {#if m.type !== 'alert'}
          <button class="btn btn-ghost" on:click={onCancelClick}>
            {m.cancelLabel ?? 'Cancel'}
          </button>
        {/if}
        <button
          class="btn {m.destructive ? 'btn-destructive' : 'btn-primary'}"
          on:click={onConfirmClick}
        >
          {m.confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
