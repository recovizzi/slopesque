/** Escapes text coming from a player before it goes into HTML (CLAUDE.md, rule 6). */
export const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
/** A player's round: the profile photo (in this room), or the first letter of the name on the player's colour. */
export const avatarHtml = (name: string, color: string, photo?: string | null, cls = 'sm') =>
  `<span class="avatar ${cls}${photo ? ' has-photo' : ''}" style="--c:${color}">${photo ? `<img src="${esc(photo)}" alt="" draggable="false">` : esc(name.slice(0, 1).toUpperCase())}</span>`;
