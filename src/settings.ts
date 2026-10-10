/** Plugin settings, stored server-side in Blinko's plugin config so they follow you across devices. */

export const CONFIG_NAME = 'handwritten-notes';

export type ModelSource = 'image' | 'main' | 'custom';
export type InsertStyle = 'plain' | 'heading' | 'quote';
export type Paper = 'lined' | 'grid' | 'dots' | 'blank';

export interface Settings {
  // AI
  modelSource: ModelSource;
  customProvider: string;
  customBaseURL: string;
  customModel: string;
  customApiKey: string;
  language: string;
  extraInstructions: string;
  // Inserting
  transcribe: boolean;
  reviewBeforeInsert: boolean;
  insertStyle: InsertStyle;
  tag: string;
  attachImage: boolean;
  // Pad
  paper: Paper;
  lineSpacing: number;
  pressure: boolean;
  penOnly: boolean;
}

export const DEFAULTS: Settings = {
  modelSource: 'image',
  customProvider: 'gemini',
  customBaseURL: '',
  customModel: '',
  customApiKey: '',
  language: '',
  extraInstructions: '',
  transcribe: true,
  reviewBeforeInsert: false,
  insertStyle: 'plain',
  tag: '',
  attachImage: true,
  paper: 'lined',
  lineSpacing: 36,
  pressure: true,
  penOnly: true,
};

const oneOf = <T extends string>(v: any, options: readonly T[], d: T): T => (options.includes(v) ? v : d);
const bool = (v: any, d: boolean) => (typeof v === 'boolean' ? v : d);
const str = (v: any, d: string) => (typeof v === 'string' ? v : d);

/** Fill gaps and drop bad values so older or hand-edited configs never break the pad. */
export function normalize(raw: any): Settings {
  const r = raw && typeof raw === 'object' ? raw : {};
  const spacing = Number(r.lineSpacing);
  return {
    modelSource: oneOf(r.modelSource, ['image', 'main', 'custom'] as const, DEFAULTS.modelSource),
    customProvider: str(r.customProvider, DEFAULTS.customProvider),
    customBaseURL: str(r.customBaseURL, '').trim(),
    customModel: str(r.customModel, '').trim(),
    customApiKey: str(r.customApiKey, '').trim(),
    language: str(r.language, '').trim(),
    extraInstructions: str(r.extraInstructions, ''),
    transcribe: bool(r.transcribe, DEFAULTS.transcribe),
    reviewBeforeInsert: bool(r.reviewBeforeInsert, DEFAULTS.reviewBeforeInsert),
    insertStyle: oneOf(r.insertStyle, ['plain', 'heading', 'quote'] as const, DEFAULTS.insertStyle),
    tag: str(r.tag, '').trim().replace(/^#+/, '').replace(/\s+/g, '-'),
    attachImage: bool(r.attachImage, DEFAULTS.attachImage),
    paper: oneOf(r.paper, ['lined', 'grid', 'dots', 'blank'] as const, DEFAULTS.paper),
    lineSpacing: Number.isFinite(spacing) ? Math.min(64, Math.max(20, Math.round(spacing))) : DEFAULTS.lineSpacing,
    pressure: bool(r.pressure, DEFAULTS.pressure),
    penOnly: bool(r.penOnly, DEFAULTS.penOnly),
  };
}

let cache: Settings | null = null;

export async function loadSettings(): Promise<Settings> {
  if (cache) return cache;
  try {
    const res: any = await window.Blinko.api.config.getPluginConfig.query({ pluginName: CONFIG_NAME });
    cache = normalize(res?.settings ? JSON.parse(res.settings) : {});
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export async function saveSettings(s: Settings): Promise<void> {
  const clean = normalize(s);
  await window.Blinko.api.config.setPluginConfig.mutate({ pluginName: CONFIG_NAME, key: 'settings', value: JSON.stringify(clean) });
  cache = clean;
}

/** Wrap the transcription the way the settings ask, ready to insert into the note. */
export function formatInsert(text: string, s: Pick<Settings, 'insertStyle' | 'tag'>): string {
  let body = text.trim();
  if (s.insertStyle === 'heading') body = `### ✍️ Handwritten\n\n${body}`;
  if (s.insertStyle === 'quote') body = body.split('\n').map(l => (l ? `> ${l}` : '>')).join('\n');
  if (s.tag) body += `\n\n#${s.tag}`;
  return `${body}\n`;
}

/** CSS background for the paper style (on screen only; never part of the exported image). */
export function paperBackground(paper: Paper, spacing: number): string {
  const c = 'rgba(128,128,128,.22)';
  switch (paper) {
    case 'lined':
      return `repeating-linear-gradient(to bottom,transparent 0,transparent ${spacing - 1}px,${c} ${spacing - 1}px,${c} ${spacing}px)`;
    case 'grid':
      return `linear-gradient(to right,${c} 1px,transparent 1px) 0 0/${spacing}px ${spacing}px,linear-gradient(to bottom,${c} 1px,transparent 1px) 0 0/${spacing}px ${spacing}px`;
    case 'dots':
      return `radial-gradient(circle,rgba(128,128,128,.45) 1.2px,transparent 1.6px) 0 0/${spacing}px ${spacing}px`;
    default:
      return 'none';
  }
}
