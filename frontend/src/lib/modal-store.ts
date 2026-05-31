import { writable } from 'svelte/store';

export type ModalConfig = {
  type: 'confirm' | 'prompt' | 'alert';
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  defaultValue?: string;
  placeholder?: string;
  resolve: (value: boolean | string | null | undefined) => void;
};

export const activeModal = writable<ModalConfig | null>(null);

function open(config: Omit<ModalConfig, 'resolve'>): Promise<any> {
  return new Promise((resolve) => {
    activeModal.set({ ...config, resolve });
  });
}

export const modal = {
  confirm(
    title: string,
    message?: string,
    options: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {}
  ): Promise<boolean> {
    return open({
      type: 'confirm',
      title,
      message,
      confirmLabel: options.confirmLabel ?? (options.destructive ? 'Delete' : 'Confirm'),
      cancelLabel: options.cancelLabel ?? 'Cancel',
      destructive: options.destructive ?? false,
    });
  },

  prompt(
    title: string,
    options: { message?: string; defaultValue?: string; placeholder?: string; confirmLabel?: string } = {}
  ): Promise<string | null> {
    return open({
      type: 'prompt',
      title,
      message: options.message,
      defaultValue: options.defaultValue ?? '',
      placeholder: options.placeholder ?? '',
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: 'Cancel',
    });
  },

  alert(
    title: string,
    message?: string,
    options: { destructive?: boolean } = {}
  ): Promise<void> {
    return open({
      type: 'alert',
      title,
      message,
      confirmLabel: 'OK',
      destructive: options.destructive ?? false,
    });
  },
};
