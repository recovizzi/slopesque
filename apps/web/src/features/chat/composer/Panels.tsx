// The panels above the chat's field: a file chosen or dropped (its preview, then Sticker, Image or Emoji with its
// name), or the room's sticker library (a click puts one above the field, its cross removes it from the room).
import type { StickerView } from '@slopesque/shared';
import { useStore } from '../../../app/store';
import { Button, Choice, Field, Icon, IconButton, Note } from '../../../design';
import { removeSticker } from '../actions';
import { fmtSize } from '../model';
import type { Attachments } from './useAttachments';

/** The upload panel while a file is there, else the stickers when asked. */
export function ChatPanels({ files }: { files: Attachments }) {
  if (files.picked) return <UploadPanel files={files} />;
  if (files.stickers)
    return (
      <StickerPanel
        onClose={() => files.setStickers(false)}
        onPick={st => files.attachIt({ kind: 'sticker', id: st.id, src: st.src, w: st.w, h: st.h })}
      />
    );
  return null;
}

function UploadPanel({ files }: { files: Attachments }) {
  const p = files.picked!;
  if (p === 'loading')
    return (
      <div className="chat-panel upload">
        <Note>Envoi…</Note>
      </div>
    );
  const head = (
    <div className="panel-head">
      <b title={p.file.name}>{p.file.name}</b>
      <small>
        {fmtSize(p.file.size)}
        {p.w ? ` · ${p.w} × ${p.h}` : ''}
      </small>
      <IconButton icon="close" label="Annuler" size="sm" onClick={files.cancelPick} />
    </div>
  );
  if (p.error)
    return (
      <div className="chat-panel upload">
        {head}
        <Note tone="alert">{p.error}</Note>
      </div>
    );
  const naming = files.naming;
  return (
    <div className="chat-panel upload">
      {head}
      <div className={`upload-preview ${naming !== null ? 'is-emoji' : ''}`}>
        <img src={p.url} alt="Aperçu" />
      </div>
      {naming !== null ? (
        <form
          className="emoji-name"
          onSubmit={e => {
            e.preventDefault();
            void files.use('emoji');
          }}
        >
          <Field label="Nom de l'emoji (s'écrit :nom: dans un message)">
            <input
              name="emojiName"
              value={naming}
              onChange={e => files.setNaming(e.target.value)}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
          </Field>
          {files.nameError ? (
            <Note tone="alert">{files.nameError}</Note>
          ) : (
            <Note>Minuscules, chiffres et _ ; tous les joueurs du salon pourront l'utiliser.</Note>
          )}
          <div className="row">
            <Button variant="ghost" size="sm" onClick={() => files.setNaming(null)}>
              Retour
            </Button>
            <Button size="sm" type="submit">
              Ajouter aux emoji
            </Button>
          </div>
        </form>
      ) : (
        <div className="upload-choice">
          <Choice
            title="Sticker"
            help="petit format, gardé dans les stickers du salon ; puis il attend d'être envoyé"
            onClick={() => void files.use('sticker')}
          />
          <Choice
            title="Image"
            help="grand format, avec un texte si tu veux (gardée une semaine) ; le serveur la compresse"
            onClick={() => void files.use('image')}
          />
          <Choice title="Emoji" help="ajouté aux emoji du salon, pour tous" onClick={files.nameIt} />
        </div>
      )}
    </div>
  );
}

function StickerPanel({ onClose, onPick }: { onClose: () => void; onPick: (st: StickerView) => void }) {
  const list = useStore(s => s.room?.stickers ?? []);
  const head = (
    <div className="panel-head">
      <b>Stickers du salon</b>
      <IconButton icon="close" label="Fermer" size="sm" onClick={onClose} />
    </div>
  );
  if (!list.length)
    return (
      <div className="chat-panel stickers">
        {head}
        <Note tone="alert">
          Aucun sticker pour l'instant. Ajoute une image en sticker : + → Fichier, ou glisse-la dans le chat.
        </Note>
      </div>
    );
  return (
    <div className="chat-panel stickers">
      {head}
      <ul className="sticker-grid">
        {list.map(st => (
          <li key={st.id}>
            <button
              className="sticker-item"
              type="button"
              title="Choisir (il attend au-dessus du champ)"
              onClick={() => onPick(st)}
            >
              <img src={st.src} width={st.w} height={st.h} alt="Sticker" />
            </button>
            <button
              className="sticker-del"
              type="button"
              title="Retirer des stickers du salon"
              aria-label="Retirer"
              onClick={() => void removeSticker(st.id)}
            >
              <Icon name="close" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
