// A screamer's image (openspec: chat-activity, Effets visuels): made light here, it travels once to the players and
// nothing keeps it.
/** The image as a light WebP (720 px at most, under 450 kB): it travels once to the players, nothing keeps it. */
export async function lightImage(f: File) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url; });
    for (const [side, q] of [[720, 0.82], [560, 0.72], [420, 0.62]] as const) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/webp', q);
      if (data.length < 450_000) return data;
    }
    return null;
  } catch { return null; } finally { URL.revokeObjectURL(url); }
}
