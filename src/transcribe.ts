/**
 * Handwriting → text with a vision model.
 *
 * Blinko's own AI endpoints only accept text (`ai.completions`), and its image OCR
 * (`describeImage`) only feeds embeddings and never returns the text. So we read the model
 * configured in Settings → AI (Image model first, then the Main chat model) through
 * `config.ai`, or a custom model from the plugin settings, and call that provider directly
 * from the browser.
 */

import type { Settings } from './settings';

export interface ModelConfig {
  modelKey: string;
  provider: { provider: string; baseURL: string | null; apiKey: string | null; title?: string };
}

export interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export const SYSTEM_PROMPT = `You transcribe handwritten notes into Markdown.
Rules:
- Output ONLY the transcription. No preamble, no commentary, no code fences.
- Keep the writer's words, spelling and line breaks. Join a sentence that was only wrapped by the page edge.
- Bullets or dashes become "- " list items; numbered items stay numbered; checkboxes become "- [ ]" or "- [x]".
- Clearly emphasized titles (underlined, boxed, much larger) become "## " headings.
- Words written with # (like #todo) stay as hashtags.
- Crossed-out words are omitted.
- An illegible word becomes [illegible].
- A drawing, arrow diagram or sketch becomes a short italic description in brackets, e.g. *[sketch: arrow from A to B]*.
- If there is no handwriting at all, output nothing.`;

export const USER_PROMPT = 'Transcribe the handwriting in this image.';

const OPENAI_DEFAULT_BASE: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  grok: 'https://api.x.ai/v1',
  xai: 'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com/v1',
  minimax: 'https://api.minimax.io/v1',
  litellm: 'http://localhost:4000/v1',
};

const trimSlash = (s: string) => s.trim().replace(/\/+$/, '');

/** System prompt plus the user's language hint and extra instructions from settings. */
export function buildSystemPrompt(opts: { language?: string; extraInstructions?: string } = {}): string {
  let p = SYSTEM_PROMPT;
  if (opts.language?.trim()) p += `\n- The writing is mostly in ${opts.language.trim()}; keep each word in the language it was written in.`;
  if (opts.extraInstructions?.trim()) p += `\n\nAdditional instructions from the writer:\n${opts.extraInstructions.trim()}`;
  return p;
}

/** Build the HTTP request for the configured provider. Pure, so it is unit-tested. */
export function buildRequest(cfg: ModelConfig, b64Png: string, systemPrompt = SYSTEM_PROMPT): HttpRequest {
  const kind = cfg.provider.provider.toLowerCase();
  const key = cfg.provider.apiKey ?? '';
  const base = cfg.provider.baseURL ? trimSlash(cfg.provider.baseURL) : '';
  const model = cfg.modelKey;

  switch (kind) {
    case 'gemini':
    case 'google': {
      // Blinko's Gemini provider ignores baseURL too.
      const id = model.replace(/^models\//, '');
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(id)}:generateContent`,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/png', data: b64Png } }, { text: USER_PROMPT }] }],
          generationConfig: { temperature: 0 },
        },
      };
    }
    case 'anthropic':
      return {
        url: `${base || 'https://api.anthropic.com/v1'}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: {
          model,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64Png } },
              { type: 'text', text: USER_PROMPT },
            ],
          }],
        },
      };
    case 'ollama': {
      const root = (base || 'http://localhost:11434').replace(/\/(api|v1)$/, '');
      return {
        url: `${root}/api/chat`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          model,
          stream: false,
          options: { temperature: 0 },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: USER_PROMPT, images: [b64Png] },
          ],
        },
      };
    }
    case 'azure':
    case 'azureopenai':
      throw new Error('Azure OpenAI is not supported for handwriting yet. Pick an OpenAI, Gemini, Anthropic, OpenRouter or Ollama vision model as the Image model.');
    default: {
      const root = base || OPENAI_DEFAULT_BASE[kind] || OPENAI_DEFAULT_BASE.openai;
      return {
        url: `${root}/chat/completions`,
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: {
          model,
          temperature: 0,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: [
                { type: 'text', text: USER_PROMPT },
                { type: 'image_url', image_url: { url: `data:image/png;base64,${b64Png}` } },
              ],
            },
          ],
        },
      };
    }
  }
}

/** Pull the text out of each provider's response shape. */
export function parseResponse(kind: string, json: any): string {
  switch (kind.toLowerCase()) {
    case 'gemini':
    case 'google':
      return (json?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('');
    case 'anthropic':
      return (json?.content ?? []).filter((c: any) => c?.type === 'text').map((c: any) => c.text).join('');
    case 'ollama':
      return json?.message?.content ?? '';
    default: {
      const c = json?.choices?.[0]?.message?.content;
      return Array.isArray(c) ? c.map((p: any) => p?.text ?? '').join('') : (c ?? '');
    }
  }
}

/** Strip a code fence or "Here is the transcription:" preamble some models add anyway. */
export function cleanTranscript(text: string): string {
  let t = text.trim();
  const fence = t.match(/^```[a-z]*\n([\s\S]*?)\n```$/i);
  if (fence) t = fence[1].trim();
  t = t.replace(/^(here is|here's) (the )?transcription[^\n]*:\s*\n+/i, '');
  return t.trim();
}

const NOT_CONFIGURED = 'No AI model is set up for handwriting. Either choose an Image model that can read images in Blinko Settings → AI (for example gemini-2.5-flash or gpt-4o-mini), or enter your own model in this plugin\'s settings (Settings → Plugins → ⚙).';

/** The model to use, per the plugin settings: Blinko's Image model (falls back to Main), Main, or a custom one. */
export async function loadModelConfig(s: Pick<Settings, 'modelSource' | 'customProvider' | 'customBaseURL' | 'customModel' | 'customApiKey'>): Promise<ModelConfig> {
  if (s.modelSource === 'custom') {
    if (!s.customModel) throw new Error('Custom model is selected in the plugin settings but no model name is filled in.');
    return {
      modelKey: s.customModel,
      provider: { provider: s.customProvider || 'openai', baseURL: s.customBaseURL || null, apiKey: s.customApiKey || null, title: 'Custom model' },
    };
  }
  const api: any = window.Blinko.api;
  const order = s.modelSource === 'main' ? (['mainModel'] as const) : (['imageModel', 'mainModel'] as const);
  for (const type of order) {
    try {
      const m = await api.config.ai.query({ type });
      if (m?.modelKey && m?.provider?.provider) return m as ModelConfig;
    } catch { /* older Blinko without config.ai, or not configured */ }
  }
  throw new Error(NOT_CONFIGURED);
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export async function transcribe(png: Blob, s: Settings, signal?: AbortSignal): Promise<string> {
  const cfg = await loadModelConfig(s);
  const req = buildRequest(cfg, await toBase64(png), buildSystemPrompt(s));
  let res: Response;
  try {
    res = await fetch(req.url, { method: 'POST', headers: req.headers, body: JSON.stringify(req.body), signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    const hint = cfg.provider.provider.toLowerCase() === 'ollama'
      ? ' For Ollama, set OLLAMA_ORIGINS to allow this Blinko address, and serve both over the same scheme (http/https).'
      : '';
    throw new Error(`Could not reach ${cfg.provider.title || cfg.provider.provider} (${e?.message || 'network error'}).${hint}`);
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || res.statusText;
    throw new Error(`${cfg.provider.title || cfg.provider.provider} / ${cfg.modelKey}: ${msg}`);
  }
  return cleanTranscript(parseResponse(cfg.provider.provider, json));
}
