/**
 * Which editor did the pen button belong to? Blinko's `getActiveEditorStore()` always returns the
 * home-page composer (#global-editor), even when the click came from the edit-note dialog. Each
 * editor's Card element carries its EditorStore as `__storeInstance`, so we remember the element
 * the user last pressed and walk up from it.
 */

let lastPressed: Element | null = null;
const onPointerDown = (e: Event) => { lastPressed = e.target as Element; };

export function trackPresses() {
  document.addEventListener('pointerdown', onPointerDown, true);
}

export function untrackPresses() {
  document.removeEventListener('pointerdown', onPointerDown, true);
  lastPressed = null;
}

const storeOf = (el: Element | null): any => (el as any)?.__storeInstance;

function visible(el: Element) {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

export function findEditorStore(): any {
  for (let el = lastPressed; el; el = el.parentElement) {
    if (storeOf(el)?.insertMarkdown) return storeOf(el);
  }
  // Toolbar rendered in a portal (top-toolbar layout): prefer an editor inside an open dialog.
  const all = Array.from(document.querySelectorAll('div')).filter(el => storeOf(el)?.insertMarkdown && visible(el));
  const inDialog = all.filter(el => el.closest('[role="dialog"]'));
  const pick = inDialog[inDialog.length - 1] ?? all[all.length - 1];
  return storeOf(pick ?? null) ?? (window.Blinko as any).getActiveEditorStore?.() ?? null;
}
