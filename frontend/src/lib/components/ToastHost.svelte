<script lang="ts">
  import { toasts } from '$lib/toast-store';
  import { CheckCircle2, PlusCircle, Pencil, Trash2, XCircle, Info } from '@lucide/svelte';

  const config: Record<string, { icon: any; cls: string }> = {
    created: { icon: PlusCircle, cls: 'bg-emerald-600  border-emerald-500  text-white' },
    updated: { icon: Pencil,     cls: 'bg-blue-600     border-blue-500     text-white' },
    deleted: { icon: Trash2,     cls: 'bg-orange-500   border-orange-400   text-white' },
    success: { icon: CheckCircle2,cls: 'bg-emerald-600 border-emerald-500  text-white' },
    error:   { icon: XCircle,    cls: 'bg-red-600      border-red-500      text-white' },
    info:    { icon: Info,       cls: 'bg-blue-600     border-blue-500     text-white' },
  };
</script>

<div class="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
  {#each $toasts as t (t.id)}
    {@const c = config[t.type]}
    <div
      class="flex items-start gap-3 rounded-lg px-4 py-3 shadow-xl border pointer-events-auto min-w-[260px] max-w-sm {c.cls}"
      role="status"
    >
      <svelte:component this={c.icon} size={17} class="mt-0.5 shrink-0 opacity-90" />
      <span class="text-sm font-medium flex-1 leading-snug">{t.message}</span>
    </div>
  {/each}
</div>
