// /effet screamer: what to show for a second on everyone's screen — an image from this device (made light here and sent
// once, never stored), a sticker of the room, a GIF, an emoji.
import { useRef, useState } from 'react';
import type { EmojiPop } from '../lib/emoji';
import type { GifPop } from '../lib/gif';
import { request } from '../net';
import { useStore } from '../store';
import { Icon, useEscape } from './common';

type Pic = { kind: 'image' | 'sticker' | 'gif' | 'emoji'; value: string };

/** The image as a light WebP (720 px at most, under 450 kB): it travels once to the players, nothing keeps it. */
async function lightImage(f: File) {
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

export function ScreamerModal({ gifs, pop, onClose }: { gifs: GifPop | null; pop: EmojiPop | null; onClose: () => void }) {
  const stickers = useStore(s => s.room?.stickers ?? []);
  const [tab, setTab] = useState<'choose' | 'stickers'>('choose'), [note, setNote] = useState(''), [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null), box = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  const send = async (pic: Pic) => {
    setBusy(true);
    const r = await request('effect:play', { kind: 'screamer', pic });
    setBusy(false);
    if (r.ok) onClose(); else setNote(r.error);
  };
  return <><div className="modal-backdrop" onClick={onClose} />
    <div className="modal screamer-modal" role="dialog" aria-modal="true" aria-label="Screamer" ref={box}>
      <div className="rules-head"><h2>Screamer</h2><button className="icon-btn sm" type="button" onClick={onClose} title="Fermer" aria-label="Fermer"><Icon name="close" /></button></div>
      <p className="note">Montré 1 seconde, en grand, au centre de l'écran de tous. Une image de ton appareil n'est pas gardée : elle part une fois.</p>
      {tab === 'choose' ? <div className="choices screamer-choices">
        <button className="choice" type="button" disabled={busy} onClick={() => file.current?.click()}><b><Icon name="file" /> Image</b><small>depuis ton appareil</small></button>
        <button className="choice" type="button" disabled={busy} onClick={() => setTab('stickers')}><b><Icon name="sticker" /> Sticker</b><small>de la bibliothèque du salon</small></button>
        <button className="choice" type="button" disabled={busy || !gifs} onClick={e => gifs?.open(e.currentTarget, g => void send({ kind: 'gif', value: g.url }))}><b><Icon name="gif" /> GIF</b><small>KLIPY ou GIPHY</small></button>
        <button className="choice" type="button" disabled={busy || !pop} onClick={e => void pop?.open(e.currentTarget, emo => void send({ kind: 'emoji', value: emo }))}><b><Icon name="smile" /> Emoji</b><small>en très grand</small></button>
      </div> : <>{stickers.length ? <ul className="sticker-grid">{stickers.map(st => <li key={st.id}>
          <button className="sticker-item" type="button" disabled={busy} title="Envoyer en screamer" onClick={() => void send({ kind: 'sticker', value: st.id })}><img src={st.src} width={st.w} height={st.h} alt="Sticker" /></button></li>)}</ul>
        : <p className="alert" role="alert">Aucun sticker dans le salon pour l'instant.</p>}
        <button className="btn ghost sm" type="button" onClick={() => setTab('choose')}>Retour</button></>}
      {note && <p className="alert" role="alert">{note}</p>}
      <input ref={file} type="file" accept="image/*" hidden onChange={async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        if (!f.type.startsWith('image/')) { setNote('Ce fichier n\'est pas une image.'); return; }
        setBusy(true);
        const data = await lightImage(f);
        setBusy(false);
        if (!data) { setNote('Cette image ne peut pas être envoyée.'); return; }
        await send({ kind: 'image', value: data });
      }} />
    </div></>;
}
