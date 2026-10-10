import { test, expect } from 'bun:test';
import { buildRequest, parseResponse, cleanTranscript, type ModelConfig } from './transcribe';
import { inkBounds } from './strokes';

const cfg = (provider: string, modelKey = 'm', baseURL: string | null = null): ModelConfig =>
  ({ modelKey, provider: { provider, baseURL, apiKey: 'k' } });

test('gemini uses generateContent with inline PNG and strips models/ prefix', () => {
  const r = buildRequest(cfg('gemini', 'models/gemini-2.5-flash'), 'AAA');
  expect(r.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  expect(r.headers['x-goog-api-key']).toBe('k');
  expect((r.body as any).contents[0].parts[0].inline_data).toEqual({ mime_type: 'image/png', data: 'AAA' });
  expect(parseResponse('gemini', { candidates: [{ content: { parts: [{ text: 'a' }, { text: 'b' }] } }] })).toBe('ab');
});

test('openai-compatible providers use chat/completions with a data URL', () => {
  const r = buildRequest(cfg('openai', 'gpt-4o-mini'), 'AAA');
  expect(r.url).toBe('https://api.openai.com/v1/chat/completions');
  expect(r.headers.Authorization).toBe('Bearer k');
  expect((r.body as any).messages[1].content[1].image_url.url).toBe('data:image/png;base64,AAA');
  expect(buildRequest(cfg('openrouter'), 'x').url).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(buildRequest(cfg('custom', 'm', 'http://host:1234/v1/'), 'x').url).toBe('http://host:1234/v1/chat/completions');
  expect(parseResponse('openai', { choices: [{ message: { content: 'hi' } }] })).toBe('hi');
});

test('anthropic and ollama shapes', () => {
  const a = buildRequest(cfg('anthropic', 'claude'), 'AAA');
  expect(a.url).toBe('https://api.anthropic.com/v1/messages');
  expect(a.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  expect(parseResponse('anthropic', { content: [{ type: 'text', text: 'x' }] })).toBe('x');
  const o = buildRequest(cfg('ollama', 'llava', 'http://192.168.1.180:11434/api'), 'AAA');
  expect(o.url).toBe('http://192.168.1.180:11434/api/chat');
  expect((o.body as any).messages[1].images).toEqual(['AAA']);
  expect(parseResponse('ollama', { message: { content: 'y' } })).toBe('y');
});

test('azure is reported as unsupported', () => {
  expect(() => buildRequest(cfg('azureopenai'), 'x')).toThrow(/Azure/);
});

test('cleanTranscript strips fences and preambles', () => {
  expect(cleanTranscript('```markdown\n- milk\n- eggs\n```')).toBe('- milk\n- eggs');
  expect(cleanTranscript("Here is the transcription:\n\nBuy milk")).toBe('Buy milk');
  expect(cleanTranscript('  plain  ')).toBe('plain');
});

test('inkBounds ignores eraser strokes and pads', () => {
  expect(inkBounds([])).toBeNull();
  expect(inkBounds([{ points: [{ x: 5, y: 5, p: .5 }], color: '#000', width: 2, erase: true }])).toBeNull();
  const b = inkBounds([{ points: [{ x: 100, y: 50, p: .5 }, { x: 200, y: 80, p: .5 }], color: '#000', width: 2 }], 10)!;
  expect(b.x).toBe(88);
  expect(b.y).toBe(38);
  expect(b.x + b.w).toBeGreaterThanOrEqual(212);
});

import { normalize, formatInsert, DEFAULTS } from './settings';
import { buildSystemPrompt } from './transcribe';

test('settings normalize fills defaults and rejects bad values', () => {
  expect(normalize(null)).toEqual(DEFAULTS);
  const s = normalize({ insertStyle: 'weird', lineSpacing: 500, tag: ' #hand written ', paper: 'grid', transcribe: false });
  expect(s.insertStyle).toBe('plain');
  expect(s.lineSpacing).toBe(64);
  expect(s.tag).toBe('hand-written');
  expect(s.paper).toBe('grid');
  expect(s.transcribe).toBe(false);
});

test('formatInsert applies style and tag', () => {
  expect(formatInsert('a\nb', { insertStyle: 'plain', tag: '' })).toBe('a\nb\n');
  expect(formatInsert('a\n\nb', { insertStyle: 'quote', tag: 'hw' })).toBe('> a\n>\n> b\n\n#hw\n');
  expect(formatInsert('x', { insertStyle: 'heading', tag: '' })).toBe('### ✍️ Handwritten\n\nx\n');
});

test('system prompt carries language and extra instructions', () => {
  const p = buildSystemPrompt({ language: 'Spanish', extraInstructions: 'w/ means with' });
  expect(p).toContain('mostly in Spanish');
  expect(p).toContain('w/ means with');
  const r = buildRequest(cfg('openai'), 'x', p);
  expect((r.body as any).messages[0].content).toBe(p);
});
