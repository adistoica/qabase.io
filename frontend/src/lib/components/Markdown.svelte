<script lang="ts">
  import { marked } from 'marked';
  export let source: string = '';
  $: html = marked.parse(source || '', { breaks: true, gfm: true });
</script>

<div class="prose-tp">
  {@html html}
</div>

<style>
  .prose-tp :global(p) {
    margin: 0.4em 0;
    line-height: 1.55;
  }
  .prose-tp :global(strong) {
    color: var(--color-foreground);
  }
  .prose-tp :global(code) {
    padding: 1px 4px;
    border-radius: 4px;
    background: var(--color-muted);
    font-size: 0.85em;
  }
  .prose-tp :global(pre) {
    background: var(--color-muted);
    padding: 0.75rem 1rem;
    border-radius: var(--radius);
    overflow-x: auto;
    font-size: 0.85em;
  }
  .prose-tp :global(ul),
  .prose-tp :global(ol) {
    padding-left: 1.25rem;
    margin: 0.4em 0;
  }
  .prose-tp :global(h1),
  .prose-tp :global(h2),
  .prose-tp :global(h3) {
    font-weight: 600;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
</style>
