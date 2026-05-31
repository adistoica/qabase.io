import { writable } from 'svelte/store';

export type Toast = {
  id: number;
  message: string;
  type: 'success' | 'created' | 'updated' | 'deleted' | 'error' | 'info';
};

export const toasts = writable<Toast[]>([]);

let _id = 0;

function add(message: string, type: Toast['type'], duration = 3500) {
  const id = ++_id;
  toasts.update((t) => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update((t) => t.filter((x) => x.id !== id));
  }, duration);
}

export const toast = {
  success: (message: string) => add(message, 'success'),
  created: (message: string) => add(message, 'created'),
  updated: (message: string) => add(message, 'updated'),
  deleted: (message: string) => add(message, 'deleted'),
  error:   (message: string) => add(message, 'error', 5000),
  info:    (message: string) => add(message, 'info'),
};
