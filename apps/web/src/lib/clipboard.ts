// The clipboard, with a fallback for the frame of the panel (where navigator.clipboard may be refused).

/** Copies a text: the clipboard, or (refused in the frame, older browsers) a hidden field selected and copied. */
export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.append(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      /* refused too */
    }
    t.remove();
    return ok;
  }
}
