import { useSyncExternalStore } from 'react';
import { storageAdapter } from '../storage/storage.adapter';

/**
 * Light/dark theme. The user picks a *preference* ("sistema" follows the
 * device); the document always carries the *resolved* theme in
 * `<html data-theme>`, so global.css needs a single dark block instead of one
 * under `prefers-color-scheme` plus another for the explicit choice.
 *
 * The preference is per user (`hub.theme` in the store), so it follows the
 * person across devices. Until the store loads, the device's own setting is
 * used — the loading screen is the only thing that can show the "wrong" theme.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'hub.theme';
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

let preference: ThemePreference = 'system';
const listeners = new Set<() => void>();

function resolve(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return darkQuery?.matches ? 'dark' : 'light';
  return pref;
}

function apply() {
  const theme = resolve(preference);
  const root = document.documentElement;
  root.dataset.theme = theme;
  // Browser/Android status bar follows the page ground.
  const ground = getComputedStyle(root).getPropertyValue('--hub-bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', ground);
  listeners.forEach((listener) => listener());
}

/** Run once, before the first render: applies the device's theme and follows its changes. */
export function initTheme() {
  apply();
  darkQuery?.addEventListener('change', () => {
    if (preference === 'system') apply();
  });
}

/** Run after the store is ready: switches to the user's saved preference. */
export function loadThemePreference() {
  const saved = storageAdapter.getItem<ThemePreference>(STORAGE_KEY);
  preference = saved === 'light' || saved === 'dark' ? saved : 'system';
  apply();
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  storageAdapter.setItem(STORAGE_KEY, next);
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current preference, re-rendering when it (or the resolved theme) changes. */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, () => preference);
}
