// Class names joined, the falsy ones left out: cls('btn', ghost && 'ghost', className).
export const cls = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ');
