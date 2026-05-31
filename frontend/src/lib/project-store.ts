import { derived, writable } from 'svelte/store';
import type { Project } from './api';

const STORAGE_KEY = 'qabase.activeProjectId';

function readInitial(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export const projects = writable<Project[]>([]);
export const activeProjectId = writable<string | null>(readInitial());

activeProjectId.subscribe((v) => {
  if (typeof window === 'undefined') return;
  if (v) window.localStorage.setItem(STORAGE_KEY, v);
  else window.localStorage.removeItem(STORAGE_KEY);
});

export const activeProject = derived(
  [projects, activeProjectId],
  ([$projects, $id]) => $projects.find((p) => p.id === $id) || $projects[0] || null
);

export const activeProjectSlug = derived(
  [projects, activeProjectId],
  ([$projects, $id]) => $projects.find((p) => p.id === $id)?.slug ?? null
);
