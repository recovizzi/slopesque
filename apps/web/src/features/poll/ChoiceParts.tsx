// The small pieces a choice is shown with, while writing, answering and in the results: its picture, its name, and
// the crown of the poll's number 1.
import type { PollPicView } from '@slopesque/shared';
import { Icon, RichText } from '../../design';

export type CustomEmoji = readonly { name: string; url: string }[];

/** A choice's picture (an image, a sticker or a GIF): `.pic-sticker` is fitted whole, the others cover their box. */
export const ChoicePic = ({ pic }: { pic: PollPicView }) => (
  <img
    className={`choice-img pic-${pic.kind}`}
    src={pic.src}
    width={pic.w}
    height={pic.h}
    alt=""
    loading="lazy"
    draggable={false}
  />
);

/** A choice's name, the room's custom emoji as their picture; « Choix 2 » for a choice that is only a picture. */
export const ChoiceLabel = ({ text, i, custom }: { text: string; i: number; custom: CustomEmoji }) =>
  text.trim() ? <RichText text={text} custom={custom} links={false} /> : <i>{`Choix ${i + 1}`}</i>;

export const Crown = () => (
  <span className="crown" title="Numéro 1">
    <Icon name="crown" />
  </span>
);
