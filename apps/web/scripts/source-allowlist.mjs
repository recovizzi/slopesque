// Provisional exceptions to the source checks (check-source.mjs), each with the feature (and its task) that removes
// it: the agent converting a feature deletes its lines here as it goes; task 4.1 empties the list, except the real
// exceptions said so. A number is how many occurrences the file may keep (it may only go down).

/** innerHTML / insertAdjacentHTML / dangerouslySetInnerHTML: HTML built as text. */
export const HTML = {
  'legacy/Html.tsx': [1, 'cleanup 4.1 (each feature stops using it first)'],
  'legacy/LiveHtml.tsx': [1, 'cleanup 4.1 (poll, wheel, cards, palmares stop using it first)'],
  'lib/emoji.ts': [1, 'chat 3.4 — the :code: suggestions (SuggestList)'],
  'features/chat/gif.ts': [3, 'chat 3.4 — the GIF window (GifPop) as a component'],
  'features/chat/hover.ts': [1, 'chat 3.4 — the quoted message on hover'],
  'features/cards/holdem/holdem-anim.ts': [1, 'cards 3.3 — the chips that fly'],
  'features/activity-picker/ActivityPicker.tsx': [1, 'rooms/account 3.5 — the pictures of the activities as JSX'],
  'fx/layer.ts': [1, "chat 3.4 (effects) — the players' rounds of the effects as elements"],
};

/** Source files over 300 lines without a `size-exception:` comment in their first lines. */
export const SIZE = {
  'app/App.tsx': 'app 3.6 — shell, settings tabs and state pages split',
  'features/chat/Chat.tsx': 'chat 3.4 — list, message, composer, panels split',
  'features/cards/holdem/holdem-view.ts': "cards 3.3 — the Hold'em views as components",
};
