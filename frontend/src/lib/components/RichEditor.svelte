<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  import { Markdown, type MarkdownStorage } from 'tiptap-markdown';
  import { Bold, Italic, Code, List, ListOrdered, Terminal, Heading2, Heading3 } from '@lucide/svelte';

  export let value: string = '';
  export let placeholder: string = '';
  export let minHeight: string = '6rem';

  const dispatch = createEventDispatcher();

  let element: HTMLDivElement;
  let editor: Editor | null = null;
  let lastFromEditor = value;

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Markdown.configure({ html: false, transformCopiedText: true }),
        Placeholder.configure({ placeholder }),
      ],
      content: '',
      onUpdate: ({ editor: e }) => {
        lastFromEditor = (e.storage as unknown as { markdown: MarkdownStorage }).markdown.getMarkdown();
        value = lastFromEditor;
      },
      onBlur: () => dispatch('blur'),
    });
    if (value) {
      editor.commands.setContent(value);
      lastFromEditor = value;
    }
  });

  $: if (editor && value !== lastFromEditor) {
    editor.commands.setContent(value || '');
    lastFromEditor = value;
  }

  onDestroy(() => editor?.destroy());

  function run(fn: () => void) {
    fn();
  }
</script>

<div class="rich-editor">
  <div class="toolbar">
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('bold')}
      title="Bold"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleBold().run())}
    ><Bold size={13} /></button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('italic')}
      title="Italic"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleItalic().run())}
    ><Italic size={13} /></button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('code')}
      title="Inline code"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleCode().run())}
    ><Code size={13} /></button>
    <span class="sep"></span>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('heading', { level: 2 })}
      title="Heading 2"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleHeading({ level: 2 }).run())}
    ><Heading2 size={13} /></button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('heading', { level: 3 })}
      title="Heading 3"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleHeading({ level: 3 }).run())}
    ><Heading3 size={13} /></button>
    <span class="sep"></span>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('bulletList')}
      title="Bullet list"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleBulletList().run())}
    ><List size={13} /></button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('orderedList')}
      title="Ordered list"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleOrderedList().run())}
    ><ListOrdered size={13} /></button>
    <button
      type="button"
      class="tb-btn"
      class:active={editor?.isActive('codeBlock')}
      title="Code block"
      on:mousedown|preventDefault={() => run(() => editor?.chain().focus().toggleCodeBlock().run())}
    ><Terminal size={13} /></button>
  </div>
  <div bind:this={element} class="editor-content" style="min-height: {minHeight}"></div>
</div>

<style>
.rich-editor {
  border: 1px solid var(--color-input);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font-size: 0.875rem;
  width: 100%;
}

.rich-editor:focus-within {
  outline: 2px solid var(--color-ring);
  outline-offset: 1px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.25rem 0.375rem;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: calc(var(--radius) - 2px);
  border: none;
  background: transparent;
  color: var(--color-muted-foreground);
  cursor: pointer;
  transition: background 100ms, color 100ms;
  padding: 0;
}

.tb-btn:hover {
  background: var(--color-muted);
  color: var(--color-foreground);
}

.tb-btn.active {
  background: var(--color-accent);
  color: var(--color-accent-foreground);
}

.sep {
  display: inline-block;
  width: 1px;
  height: 1rem;
  background: var(--color-border);
  margin: 0 0.25rem;
  flex-shrink: 0;
}

.editor-content {
  padding: 0.5rem 0.75rem;
  cursor: text;
}

.editor-content :global(.ProseMirror) {
  outline: none;
  min-height: inherit;
}

.editor-content :global(.ProseMirror > *:first-child) {
  margin-top: 0;
}

.editor-content :global(.ProseMirror > *:last-child) {
  margin-bottom: 0;
}

.editor-content :global(.ProseMirror p) {
  margin: 0.3em 0;
  line-height: 1.55;
}

/* Placeholder */
.editor-content :global(.ProseMirror p.is-empty:first-child::before),
.editor-content :global(.ProseMirror p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--color-muted-foreground);
  float: left;
  height: 0;
  pointer-events: none;
}

.editor-content :global(.ProseMirror strong) {
  font-weight: 600;
  color: var(--color-foreground);
}

.editor-content :global(.ProseMirror em) {
  font-style: italic;
}

.editor-content :global(.ProseMirror code) {
  background: var(--color-muted);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.85em;
}

.editor-content :global(.ProseMirror pre) {
  background: var(--color-muted);
  padding: 0.75rem 1rem;
  border-radius: var(--radius);
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.85em;
  margin: 0.4em 0;
}

.editor-content :global(.ProseMirror pre code) {
  background: none;
  padding: 0;
  font-size: inherit;
}

.editor-content :global(.ProseMirror ul),
.editor-content :global(.ProseMirror ol) {
  padding-left: 1.25rem;
  margin: 0.3em 0;
}

.editor-content :global(.ProseMirror li) {
  margin: 0.15em 0;
}

.editor-content :global(.ProseMirror h2) {
  font-size: 1.1em;
  font-weight: 600;
  margin-top: 0.75em;
  margin-bottom: 0.2em;
}

.editor-content :global(.ProseMirror h3) {
  font-size: 1em;
  font-weight: 600;
  margin-top: 0.5em;
  margin-bottom: 0.2em;
}
</style>
