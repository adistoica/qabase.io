<script lang="ts">
  import { page } from '$app/stores';
  import { projects, activeProjectId } from '$lib/project-store';
  import { goto, afterNavigate } from '$app/navigation';

  afterNavigate(() => {
    const slug = $page.params.projectSlug;
    const project = $projects.find((p) => p.slug === slug);
    if ($projects.length && !project) goto('/');
    if (project && project.id !== $activeProjectId) activeProjectId.set(project.id);
  });
</script>

<slot />
