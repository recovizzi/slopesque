// External web pages shown in the game area (« intégrations ») — the first: the game Low Tide. The page is framed
// as it is; its address can be changed by the host, but only to a page that declares the expected name (its web app
// manifest `name` / `short_name`, its <title>, or <meta name="application-name">), so an unknown page can't be
// slipped in. Reading another site's page needs the permission to access it (optional_host_permissions, asked to
// the host when he checks an address); the page's HTML is parsed, never run.
// See openspec/changes/define-game-concept/specs/web-integration/spec.md.
declare const chrome: any;

export interface Integration {
  name: string;
  url: string;
  help: string;
}
export const INTEGRATIONS = {
  lowtide: {
    name: 'Low Tide',
    url: 'https://1ddf-90-85-208-125.ngrok-free.app/',
    help: 'Le jeu web Low Tide (golf sur les estrans, un parcours par jour), affiché dans la zone de jeu. Pas de points.',
  },
} satisfies Record<string, Integration>;
export type IntegrationId = keyof typeof INTEGRATIONS;

/** The room's address of Low Tide: the one checked by the host, or its own. */
export const urlOf = (web: Record<string, string>) => web.lowtide ?? INTEGRATIONS.lowtide.url;

export type Verdict =
  | { ok: true; url: string; name: string }
  | { ok: false; reason: 'url' | 'permission' | 'offline' | 'name'; found?: string; detail?: string };

const norm = (s: string) => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const TIMEOUT = 8000;

async function get(url: string) {
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    // ngrok's free tunnels answer browsers with a warning page, unless this header is sent
    return await fetch(url, {
      headers: { 'ngrok-skip-browser-warning': '1' },
      credentials: 'omit',
      signal: ctl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** The names a page declares: its manifest's name and short_name, its title, its application-name. */
async function declaredNames(res: Response): Promise<string[]> {
  const doc = new DOMParser().parseFromString(await res.text(), 'text/html'); // parsed, scripts never run
  const names = [doc.title, doc.querySelector('meta[name="application-name"]')?.getAttribute('content') ?? ''];
  const href = doc.querySelector('link[rel~="manifest"]')?.getAttribute('href');
  if (href) {
    try {
      const m = await (await get(new URL(href, res.url).href)).json();
      names.unshift(String(m.name ?? ''), String(m.short_name ?? ''));
    } catch {
      /* no manifest: the title is enough */
    }
  }
  return names.map(n => n.trim()).filter(Boolean);
}

/** Checks that `url` is the expected app. Call it from a click: the permission to read the site is asked first
 *  (Firefox wants it asked right in the user's gesture). */
export async function verify(url: string, expected: string): Promise<Verdict> {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return { ok: false, reason: 'url' };
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local))
    return { ok: false, reason: 'url', detail: 'https' };
  if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
    let granted: boolean;
    try {
      granted = await chrome.permissions.request({ origins: [`${u.origin}/*`] });
    } catch {
      granted = false;
    }
    if (!granted) return { ok: false, reason: 'permission' };
  }
  let res: Response;
  try {
    res = await get(u.href);
  } catch (e) {
    return {
      ok: false,
      reason: 'offline',
      detail: (e as Error).name === 'AbortError' ? 'délai dépassé' : 'pas de réponse',
    };
  }
  if (!res.ok) return { ok: false, reason: 'offline', detail: `HTTP ${res.status}` };
  const names = await declaredNames(res);
  const match = names.find(n => norm(n) === norm(expected));
  return match ? { ok: true, url: u.href, name: match } : { ok: false, reason: 'name', found: names[0] ?? '' };
}

/** What to tell the host about a check. */
export function verdictText(v: Verdict, expected: string, url: string): string {
  if (v.ok) return `« ${v.name} » trouvé à cette adresse : elle est enregistrée pour le salon.`;
  if (v.reason === 'url')
    return v.detail === 'https'
      ? "L'adresse doit commencer par https:// (http:// seulement pour localhost)."
      : "Ce n'est pas une adresse web valide.";
  if (v.reason === 'permission')
    return 'Permission refusée : sans elle, impossible de lire la page pour vérifier son nom. Adresse non enregistrée.';
  if (v.reason === 'offline') return `Page injoignable (${v.detail}) : ${url}. Adresse non enregistrée.`;
  return v.found
    ? `Cette page se déclare « ${v.found} », pas « ${expected} » : adresse refusée.`
    : `Cette page ne déclare aucun nom (ni manifeste ni titre) : impossible de vérifier que c'est ${expected}, adresse refusée.`;
}

/** Does the page answer, before it is framed (a framed page that doesn't answer shows a browser error, which the
 *  frame can't tell us)? With the permission to read the site (the host who checked it): its HTTP status; without
 *  (the other players): only whether the server answers at all. */
export async function probe(url: string): Promise<boolean> {
  let readable: boolean;
  try {
    const origin = new URL(url).origin;
    readable =
      typeof chrome !== 'undefined' &&
      !!chrome.permissions?.contains &&
      (await chrome.permissions.contains({ origins: [`${origin}/*`] }));
  } catch {
    return false;
  }
  const ctl = new AbortController(),
    t = setTimeout(() => ctl.abort(), TIMEOUT);
  try {
    const res = readable
      ? await fetch(url, { headers: { 'ngrok-skip-browser-warning': '1' }, credentials: 'omit', signal: ctl.signal })
      : await fetch(url, { mode: 'no-cors', credentials: 'omit', signal: ctl.signal });
    return readable ? res.ok : true; // no-cors: an answer, whatever it is
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}
