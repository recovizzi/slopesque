// The host writes the poll in the game area (openspec: poll-activity): the question, the kind of answer, then the
// choices (each with an optional picture) or the propositions of the gradient, whose shape is previewed.
import { Fragment, useState, type Dispatch, type SetStateAction } from 'react';
import { Poll } from '@slopesque/engines';
import { useStore } from '../../app/store';
import { Button, Field, Note, Segmented, TextInput } from '../../design';
import type { EmojiPop } from '../../lib/emoji';
import { ChoiceRow, ChoiceStickers, type MediaKind, type MediaTarget } from './ChoiceRow';
import { Gradient } from './Gradient';
import * as M from './model';
import { useChoiceMedia } from './useChoiceMedia';

const KINDS = (Object.keys(Poll.POLL_KINDS) as M.PollKind[]).map(k => ({ value: k, label: Poll.POLL_KINDS[k].name }));

export interface PollComposeProps {
  draft: M.Draft;
  onDraft: Dispatch<SetStateAction<M.Draft>>;
  /** A problem to say (a file that isn't an image, the poll refused…). */
  note: string;
  onNote: (s: string) => void;
  pop: EmojiPop | null;
}

export function PollCompose({ draft, onDraft, note, onNote, pop }: PollComposeProps) {
  const stickers = useStore(s => s.room!.stickers);
  const [menu, setMenu] = useState<number | null>(null), // the choice whose "+" menu is open
    [stickersFor, setStickersFor] = useState<number | null>(null); // the choice whose room stickers are shown
  const media = useChoiceMedia(onDraft, onNote, pop);
  const n = draft.choices.length,
    withPics = draft.kind === 'choices';
  const alert = note ? <Note tone="alert">{note}</Note> : null;

  const onMedia = (i: number, kind: MediaKind, at: MediaTarget) => {
    const key = draft.keys[i];
    if (kind === 'file') media.pickFile(key);
    else if (kind === 'gif') media.pickGif(key, at);
    else if (kind === 'sticker') setStickersFor(i);
    else media.pickEmoji(key, at);
  };
  const remove = (i: number) => {
    onDraft(d => M.removeChoice(d, i));
    setMenu(null);
    setStickersFor(null);
  };

  return (
    <div className="poll-compose" ref={media.gifHost}>
      <Field label="Question">
        <TextInput
          data-poll="question"
          value={draft.question}
          maxLength={120}
          placeholder="Ta question"
          autoComplete="off"
          onChange={e => onDraft(d => M.setQuestion(d, e.target.value))}
        />
      </Field>
      <Field as="div" label="Type de réponse" help={Poll.POLL_KINDS[draft.kind].help}>
        <Segmented
          label="Type de réponse"
          options={KINDS}
          value={draft.kind}
          onChange={k => onDraft(d => M.setKind(d, k))}
        />
      </Field>
      {draft.kind === 'free' ? (
        alert
      ) : (
        <Field as="div" label={draft.kind === 'gradient' ? 'Propositions' : 'Choix'}>
          <ol className="poll-inputs">
            {draft.choices.map((c, i) => (
              <Fragment key={draft.keys[i]}>
                <ChoiceRow
                  i={i}
                  kind={draft.kind}
                  text={c}
                  pic={withPics ? (draft.pics[i] ?? null) : null}
                  removable={n > Poll.MIN_CHOICES}
                  menuOpen={menu === i}
                  onText={t => onDraft(d => M.setChoice(d, i, t))}
                  onMenu={open => {
                    setMenu(open ? i : null);
                    if (open) {
                      setStickersFor(null);
                      onNote('');
                    }
                  }}
                  onMedia={(kind, at) => onMedia(i, kind, at)}
                  onFile={f => void media.sendFile(draft.keys[i], f)}
                  onRemovePic={() => onDraft(d => M.setPic(d, i, null))}
                  onRemove={() => remove(i)}
                />
                {stickersFor === i && (
                  <ChoiceStickers
                    i={i}
                    stickers={stickers}
                    onPick={s => {
                      media.sticker(draft.keys[i], s);
                      setStickersFor(null);
                    }}
                    onClose={() => setStickersFor(null)}
                  />
                )}
              </Fragment>
            ))}
          </ol>
          {n < Poll.MAX_CHOICES && (
            <Button variant="ghost" size="sm" data-action="poll-add" onClick={() => onDraft(M.addChoice)}>
              {`+ Ajouter ${draft.kind === 'gradient' ? 'une proposition' : 'un choix'}`}
            </Button>
          )}
          {withPics && (
            <Note>
              Une image par choix si tu veux (pas obligatoire) : + (image, GIF, sticker, emoji) ou glisse une image sur
              la ligne.
            </Note>
          )}
          {alert}
        </Field>
      )}
      {draft.kind === 'gradient' && (
        <div className="poll-preview">
          <Gradient choices={draft.choices} />
          <Note>{n === 2 ? 'Curseur entre les deux propositions.' : `Forme à ${n} coins (2D).`}</Note>
        </div>
      )}
      <input
        ref={media.file}
        type="file"
        accept="image/*"
        hidden
        onChange={e => {
          void media.onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
