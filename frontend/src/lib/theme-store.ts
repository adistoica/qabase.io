import { writable } from 'svelte/store';

export type ColorScheme = 'zinc' | 'ocean' | 'violet' | 'ember' | 'rose' | 'forest';
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeSettings {
  mode: ThemeMode;
  color: ColorScheme;
}

export const COLORS: ColorScheme[] = ['zinc', 'ocean', 'violet', 'ember', 'rose', 'forest'];
export const MODES: ThemeMode[] = ['light', 'dark', 'system'];

export const colorMeta: Record<ColorScheme, { label: string; swatch: string }> = {
  zinc:   { label: 'Zinc',   swatch: '#71717a' },
  ocean:  { label: 'Ocean',  swatch: '#3b6fd4' },
  violet: { label: 'Violet', swatch: '#7c3aed' },
  ember:  { label: 'Ember',  swatch: '#e06c1a' },
  rose:   { label: 'Rose',   swatch: '#e11d48' },
  forest: { label: 'Forest', swatch: '#16a34a' },
};

export const modeLabel: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const KEY = 'qabase.theme';

function readInitial(): ThemeSettings {
  if (typeof window === 'undefined') return { mode: 'system', color: 'zinc' };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const mode: ThemeMode = MODES.includes(parsed.mode) ? parsed.mode : 'system';
      const color: ColorScheme = COLORS.includes(parsed.color) ? parsed.color : 'zinc';
      return { mode, color };
    }
    // Migrate from old string-only format
    const legacy = window.localStorage.getItem(KEY);
    if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
      return { mode: legacy as ThemeMode, color: 'zinc' };
    }
  } catch { /* ignore */ }
  return { mode: 'system', color: 'zinc' };
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolvedDark(mode: ThemeMode): boolean {
  if (mode === 'system') return systemPrefersDark();
  return mode === 'dark';
}

function apply(s: ThemeSettings) {
  if (typeof document === 'undefined') return;
  const dark = resolvedDark(s.mode);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  if (s.color === 'zinc') {
    document.documentElement.removeAttribute('data-color');
  } else {
    document.documentElement.setAttribute('data-color', s.color);
  }
}

export const themeSettings = writable<ThemeSettings>(readInitial());

themeSettings.subscribe((s) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  apply(s);
});

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', () => {
    themeSettings.update((s) => {
      if (s.mode === 'system') apply(s);
      return s;
    });
  });
}
