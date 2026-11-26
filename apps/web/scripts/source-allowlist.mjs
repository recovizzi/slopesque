// Provisional exceptions to the source checks (check-source.mjs), each with the feature (and its task) that removes
// it: the agent converting a feature deletes its lines here as it goes; task 4.1 empties the list, except the real
// exceptions said so. A number is how many occurrences the file may keep (it may only go down).

/** innerHTML / insertAdjacentHTML / dangerouslySetInnerHTML: HTML built as text. */
export const HTML = {
  'legacy/Html.tsx': [1, 'cleanup 4.1 (each feature stops using it first)'],
  'legacy/LiveHtml.tsx': [1, 'cleanup 4.1 (poll, wheel, cards, palmares stop using it first)'],
  'features/cards/holdem/holdem-anim.ts': [1, 'cards 3.3 — the chips that fly'],
};

/** Source files over 300 lines without a `size-exception:` comment in their first lines. */
export const SIZE = {
  'features/cards/holdem/holdem-view.ts': "cards 3.3 — the Hold'em views as components",
};
