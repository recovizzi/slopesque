// What stays on this device only (openspec: player-account, Sauvegarde liée au code): the user code, the server's
// address, the theme, the recent reactions, the room open. chrome.storage.local in the extension, localStorage on a page.
import type { GifRef } from '@slopesque/shared';

declare const chrome: any;

export interface Device {
  code: string;                 // '' before the first launch is done
  server: string;
  theme: 'auto' | 'light' | 'dark';
  roomKey: string;              // the room open last
  recent: string[];             // my last reactions
  gifRecent: GifRef[];          // the GIFs I sent last (50 at most)
}

export const DEFAULT_SERVER = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? 'http://localhost:3100';
const DEFAULTS: Device = { code: '', server: DEFAULT_SERVER, theme: 'auto', roomKey: '', recent: [], gifRecent: [] };
const KEY = 'slp-device';
const ext = () => typeof chrome !== 'undefined' && !!chrome.storage?.local;

export async function loadDevice(): Promise<Device> {
  try {
    const raw = ext() ? (await chrome.storage.local.get({ [KEY]: null }))[KEY] : JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return { ...DEFAULTS, ...(raw ?? {}) };
  } catch { return { ...DEFAULTS }; }
}

export async function saveDevice(d: Device) {
  try {
    if (ext()) await chrome.storage.local.set({ [KEY]: d });
    else localStorage.setItem(KEY, JSON.stringify(d));
  } catch { /* private mode, quota: kept in memory */ }
}
