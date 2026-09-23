import { useSyncExternalStore } from 'react';

export type Theme = 'print' | 'lantern';

const KEY = 'meniscus-theme';
const listeners = new Set<() => void>();

function saved(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'print' || t === 'lantern' ? t : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'lantern' : 'print';
}

let current: Theme = typeof window === 'undefined' ? 'print' : (saved() ?? system());

/** Applies the saved or system theme to <html> before first paint. */
export function initTheme(): void {
  document.documentElement.dataset.theme = current;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (saved()) return;
    setTheme(system(), false);
  });
}

export function setTheme(theme: Theme, persist = true): void {
  current = theme;
  document.documentElement.dataset.theme = theme;
  if (persist) {
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* private mode: the choice lasts for this page */
    }
  }
  for (const l of listeners) l();
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => 'print',
  );
}

/** The engraving variant for the current ink: print (ink on stock) or lantern (light on dark). */
export function plateSrc(name: 'opticks-plate-2' | 'opticks-plate-4', theme: Theme): string {
  return `/plates/${name}${theme === 'lantern' ? '-lantern' : ''}.webp`;
}
