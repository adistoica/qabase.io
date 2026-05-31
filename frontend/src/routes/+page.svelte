<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { projects } from '$lib/project-store';
  import { get } from 'svelte/store';

  onMount(() => {
    const ps = get(projects);
    if (ps.length) goto(`/${ps[0].slug}/`, { replaceState: true });
  });
</script>
