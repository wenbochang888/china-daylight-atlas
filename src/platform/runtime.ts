import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

export const nativeIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
export const preferenceKeys = { music: 'china-daylight-atlas:music-enabled', theme: 'china-daylight-atlas:theme' } as const;
const preferences = new Map<string, string | null>();
const writes = new Map<string, Promise<void>>();

// Native preferences finish before Vue mounts; no asynchronous read can later
// replace a user's choice. Web keeps its existing synchronous localStorage.
export async function initializePlatform() {
  if (!nativeIos) return;
  document.documentElement.dataset.platform = 'ios';
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Promise.all(Object.values(preferenceKeys).map(async key => {
      try { preferences.set(key, (await Preferences.get({ key })).value); }
      catch { preferences.set(key, null); }
    }));
  } catch { /* The default preferences remain usable. */ }
}
export function readPreference(key: string): string | null {
  if (nativeIos) return preferences.get(key) ?? null;
  try { return localStorage.getItem(key); } catch { return null; }
}
export function writePreference(key: string, value: string) {
  if (!nativeIos) { try { localStorage.setItem(key, value); } catch { /* In-page choice remains usable. */ } return; }
  preferences.set(key, value);
  const next = (writes.get(key) ?? Promise.resolve()).then(async () => {
    const { Preferences } = await import('@capacitor/preferences');
    await Preferences.set({ key, value });
  }).catch(() => { /* Keep the in-page choice if native storage is unavailable. */ });
  writes.set(key, next);
  void next.finally(() => { if (writes.get(key) === next) writes.delete(key); });
}

export function listenAppActivity(callback: (active: boolean) => void): () => void {
  if (!nativeIos) return () => {};
  let disposed = false, listener: PluginListenerHandle | undefined, revision = 0;
  void (async () => {
    const { App } = await import('@capacitor/app');
    if (disposed) return;
    listener = await App.addListener('appStateChange', ({ isActive }) => {
      ++revision; if (!disposed) callback(isActive);
    });
    if (disposed) { await listener.remove(); return; }
    const attempt = revision, state = await App.getState();
    if (!disposed && attempt === revision) callback(state.isActive);
  })().catch(() => { /* Browser visibility handling remains active as fallback. */ });
  return () => { disposed = true; void listener?.remove().catch(() => {}); };
}

let appearanceRevision = 0, appearanceQueue = Promise.resolve();
let currentAppearance = { dark: false, immersive: false };
export function setSystemAppearance(dark: boolean, immersive: boolean) {
  if (!nativeIos) return;
  currentAppearance = { dark, immersive };
  const attempt = ++appearanceRevision;
  appearanceQueue = appearanceQueue.then(async () => {
    const { StatusBar, Style, Animation } = await import('@capacitor/status-bar');
    if (attempt !== appearanceRevision) return;
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
    if (attempt !== appearanceRevision) return;
    if (immersive) await StatusBar.hide({ animation: Animation.None });
    else await StatusBar.show({ animation: Animation.None });
  }).catch(() => { /* CSS safe areas keep controls usable when system UI refuses. */ });
}
export async function openExternalUrl(url: string) {
  if (!nativeIos) return;
  const { Browser } = await import('@capacitor/browser');
  const listener = await Browser.addListener('browserFinished', () => {
    void listener.remove().catch(() => {});
    // StatusBar's viewDidAppear resets its config when Safari is dismissed.
    setSystemAppearance(currentAppearance.dark, currentAppearance.immersive);
  });
  try { await Browser.open({ url }); }
  catch (error) { await listener.remove().catch(() => {}); throw error; }
}
