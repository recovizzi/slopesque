/** A server address reached without encryption, other than this machine or the local network (realtime-sync,
 *  Connexion chiffrée): the panel shows « Connexion non chiffrée ». */
export function isInsecureUrl(address: string): boolean {
  let u: URL;
  try { u = new URL(address); } catch { return false; }
  if (u.protocol === 'https:' || u.protocol === 'wss:') return false;
  const h = u.hostname.replace(/^\[|\]$/g, '');
  const local = h === 'localhost' || h === '::1' || /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.endsWith('.local');
  return !local;
}
