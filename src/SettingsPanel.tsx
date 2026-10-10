/** @jsxImportSource preact */
import { useEffect, useState } from 'preact/hooks';
import { DEFAULTS, loadSettings, saveSettings, type Settings } from './settings';
import { loadModelConfig, transcribe } from './transcribe';

const PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', model: 'gemini-2.5-flash' },
  { id: 'openai', label: 'OpenAI', model: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic (Claude)', model: 'claude-haiku-4-5' },
  { id: 'openrouter', label: 'OpenRouter', model: 'google/gemini-2.5-flash' },
  { id: 'ollama', label: 'Ollama (local)', model: 'qwen2.5vl' },
  { id: 'custom', label: 'Other OpenAI-compatible', model: '' },
];

/** A tiny handwriting-like sample, so "Test" checks the whole path with a real image. */
async function samplePng(): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = 520;
  c.height = 140;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#111';
  ctx.font = 'italic 44px "Segoe Script","Bradley Hand","Comic Sans MS",cursive';
  ctx.fillText('Buy milk tomorrow', 24, 86);
  return new Promise(r => c.toBlob(b => r(b!), 'image/png'));
}

export function SettingsPanel() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState<Settings | null>(null);
  const [status, setStatus] = useState<{ ok?: string; err?: string; busy?: string }>({});
  const [blinkoModel, setBlinkoModel] = useState('');

  useEffect(() => {
    loadSettings().then(v => { setS({ ...v }); setSaved(v); });
  }, []);

  // Show which Blinko model "Image model"/"Main model" currently points to.
  useEffect(() => {
    if (!s || s.modelSource === 'custom') { setBlinkoModel(''); return; }
    loadModelConfig(s)
      .then(m => setBlinkoModel(`Currently: ${m.provider.title || m.provider.provider} / ${m.modelKey}`))
      .catch(e => setBlinkoModel(e?.message || 'Not configured'));
  }, [s?.modelSource]);

  if (!s) return <div class="hw-set">Loading…</div>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setStatus({}); };
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const val = (e: Event) => (e.target as HTMLInputElement).value;
  const checked = (e: Event) => (e.target as HTMLInputElement).checked;

  const save = async () => {
    setStatus({ busy: 'Saving…' });
    try {
      await saveSettings(s);
      const v = await loadSettings();
      setS({ ...v }); setSaved(v);
      setStatus({ ok: 'Saved. Applies the next time you open the pad.' });
    } catch (e: any) {
      setStatus({ err: e?.message || 'Could not save' });
    }
  };

  const test = async () => {
    setStatus({ busy: 'Sending a sample image to the model…' });
    try {
      const text = await transcribe(await samplePng(), s);
      setStatus(text
        ? { ok: `Works. The model read the sample as:\n${text}` }
        : { err: 'The model answered but returned no text. It may not support images.' });
    } catch (e: any) {
      setStatus({ err: e?.message || String(e) });
    }
  };

  const provider = PROVIDERS.find(p => p.id === s.customProvider) ?? PROVIDERS[0];

  return (
    <div class="hw-set">
      <section>
        <h3>AI transcription</h3>
        <label class="hw-field">
          <span>Model</span>
          <select value={s.modelSource} onChange={e => set('modelSource', val(e) as Settings['modelSource'])}>
            <option value="image">Blinko's Image model (falls back to Main model)</option>
            <option value="main">Blinko's Main chat model</option>
            <option value="custom">My own model for handwriting only</option>
          </select>
          {blinkoModel && <span class="hw-hint">{blinkoModel}</span>}
        </label>

        {s.modelSource === 'custom' && (
          <>
            <label class="hw-field">
              <span>Provider</span>
              <select value={s.customProvider} onChange={e => set('customProvider', val(e))}>
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
            <label class="hw-field">
              <span>Model name</span>
              <input type="text" value={s.customModel} placeholder={provider.model || 'model id'} onInput={e => set('customModel', val(e))} />
              <span class="hw-hint">It must be able to read images.</span>
            </label>
            {s.customProvider !== 'ollama' && (
              <label class="hw-field">
                <span>API key</span>
                <input type="password" value={s.customApiKey} autoComplete="off" onInput={e => set('customApiKey', val(e))} />
                <span class="hw-hint">Saved in your Blinko account's plugin settings and sent only to this provider.</span>
              </label>
            )}
            {(s.customProvider === 'ollama' || s.customProvider === 'custom' || s.customProvider === 'openai') && (
              <label class="hw-field">
                <span>Base URL {s.customProvider === 'openai' ? '(optional)' : ''}</span>
                <input type="text" value={s.customBaseURL}
                  placeholder={s.customProvider === 'ollama' ? 'http://192.168.1.180:11434' : 'https://…/v1'}
                  onInput={e => set('customBaseURL', val(e))} />
              </label>
            )}
          </>
        )}

        <label class="hw-field">
          <span>Language</span>
          <input type="text" value={s.language} placeholder="Auto-detect (e.g. English, Spanish, English and Spanish)"
            onInput={e => set('language', val(e))} />
        </label>
        <label class="hw-field">
          <span>Extra instructions for the AI</span>
          <textarea value={s.extraInstructions} onInput={e => set('extraInstructions', val(e))}
            placeholder={'e.g. "w/" means "with". Turn dates into YYYY-MM-DD. Names I use often: …'} />
        </label>
        <div class="hw-row">
          <button class="hw-btn ghost" disabled={!!status.busy} onClick={test}>Test transcription</button>
          <span class="hw-hint">Uses the settings above, even before you save.</span>
        </div>
      </section>

      <section>
        <h3>When you finish writing</h3>
        <label class="hw-check">
          <input type="checkbox" checked={s.transcribe} onChange={e => set('transcribe', checked(e))} />
          Transcribe handwriting into text (off: just attach the image)
        </label>
        <label class="hw-check">
          <input type="checkbox" checked={s.reviewBeforeInsert} disabled={!s.transcribe} onChange={e => set('reviewBeforeInsert', checked(e))} />
          Let me review and edit the text before it goes into the note
        </label>
        <label class="hw-check">
          <input type="checkbox" checked={s.attachImage} onChange={e => set('attachImage', checked(e))} />
          Attach the handwriting image by default
        </label>
        <label class="hw-field">
          <span>Text style in the note</span>
          <select value={s.insertStyle} onChange={e => set('insertStyle', val(e) as Settings['insertStyle'])}>
            <option value="plain">Plain text</option>
            <option value="heading">Under a "✍️ Handwritten" heading</option>
            <option value="quote">As a quote block</option>
          </select>
        </label>
        <label class="hw-field">
          <span>Add a tag</span>
          <input type="text" value={s.tag} placeholder="none (e.g. handwritten)" onInput={e => set('tag', val(e))} />
        </label>
      </section>

      <section>
        <h3>Writing pad</h3>
        <label class="hw-field">
          <span>Paper</span>
          <select value={s.paper} onChange={e => set('paper', val(e) as Settings['paper'])}>
            <option value="lined">Lined</option>
            <option value="grid">Grid</option>
            <option value="dots">Dot grid</option>
            <option value="blank">Blank</option>
          </select>
        </label>
        {s.paper !== 'blank' && (
          <label class="hw-field">
            <span>Line spacing: {s.lineSpacing}px</span>
            <input type="range" min={20} max={64} step={2} value={s.lineSpacing} onInput={e => set('lineSpacing', Number(val(e)))} />
          </label>
        )}
        <label class="hw-check">
          <input type="checkbox" checked={s.pressure} onChange={e => set('pressure', checked(e))} />
          Pen pressure changes line thickness
        </label>
        <label class="hw-check">
          <input type="checkbox" checked={s.penOnly} onChange={e => set('penOnly', checked(e))} />
          Stylus only: fingers and palms scroll instead of drawing
        </label>
      </section>

      <div class="hw-row">
        <button class="hw-btn" disabled={!dirty || !!status.busy} onClick={save}>Save settings</button>
        <button class="hw-btn ghost" disabled={!!status.busy} onClick={() => setS({ ...DEFAULTS })}>Reset to defaults</button>
        {status.busy && <span class="hw-hint">{status.busy}</span>}
        {status.ok && <span class="hw-ok">{status.ok}</span>}
        {status.err && <span class="hw-err">{status.err}</span>}
      </div>
    </div>
  );
}
