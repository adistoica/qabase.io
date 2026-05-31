import { writable } from 'svelte/store';

export const sidebarOpen = writable<boolean>(false);
export const sidebarCollapsed = writable<boolean>(false);
