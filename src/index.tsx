/** @jsxImportSource preact */
/// <reference types="systemjs" />
/// <reference types="blinko" />

import type { BasePlugin } from 'blinko';
import { render } from 'preact';
import plugin from '../plugin.json';
import { HandwritingPad } from './HandwritingPad';
import { findEditorStore, trackPresses, untrackPresses } from './editorTarget';
import { CSS } from './styles';

/**
 * Handwritten Notes: a pen button in the note editor toolbar opens a writing pad. "Transcribe & insert"
 * sends the page to the vision model configured in Blinko, puts the text into the note and attaches
 * the handwriting image, so the note saves with both.
 */
const STYLE_ID = 'hw-style';
let host: HTMLElement | null = null;
let watcher: number | undefined;

function closePad() {
  if (watcher) window.clearInterval(watcher);
  watcher = undefined;
  if (!host) return;
  render(null, host);
  host = null;
  window.Blinko.closeDialog();
}

function openPad() {
  const editor = findEditorStore(); // capture now: the dialog will become the "last pressed" element
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  if (host) render(null, host);
  const el = document.createElement('div');
  host = el;
  render(<HandwritingPad editor={editor} onClose={closePad} />, el);
  window.Blinko.showDialog({ title: '✍️ Handwriting', size: '5xl', content: () => el });
  // Blinko's dialog can be dismissed (Esc, ✕) without telling us; unmount once our element is gone.
  if (watcher) window.clearInterval(watcher);
  let shown = false;
  watcher = window.setInterval(() => {
    if (el.isConnected) shown = true;
    else if (shown && host === el) { render(null, el); host = null; window.clearInterval(watcher); watcher = undefined; }
  }, 500);
}

System.register([], (exports) => ({
  execute: () => {
    exports('default', class Plugin implements BasePlugin {
      constructor() {
        Object.assign(this, plugin);
      }

      withSettingPanel = false;

      async init() {
        trackPresses();
        window.Blinko.addToolBarIcon({
          name: 'handwriting',
          icon: 'solar:pen-2-linear',
          tooltip: 'Handwrite (stylus)',
          onClick: openPad,
        });
      }

      destroy() {
        untrackPresses();
        closePad();
        document.getElementById(STYLE_ID)?.remove();
      }
    });
  }
}));
