# Handwritten Notes (for Blinko)

Write inside a note with a tablet stylus; AI turns the handwriting into note text.

## How it works

1. In the note editor (new note or editing one), tap the **pen** icon in the toolbar.
2. Write on the lined pad. Tools: 4 ink colors (the first follows light/dark mode), 3 pen widths,
   eraser (the stylus's eraser end works too), undo/redo, clear, **+ Page** (the pad also grows as
   you near the bottom). Pen pressure changes line width.
3. Tap **Transcribe & insert**. The page is sent to your vision model, the transcription is inserted
   into the note at the cursor as Markdown (lists, checkboxes, headings and #tags are kept), and the
   handwriting is attached as a PNG (untick "Also attach the handwriting image" to skip that).
4. Save the note as usual. The text is ordinary note content, so search, tags and Blinko AI use it.

If transcription fails, the error is shown and you can **Try again** or **Attach image only**. Closing
the pad by accident keeps your ink until you insert or clear it (until the page is reloaded).

**Stylus only** (on by default): once a stylus is detected, fingers and palms scroll the pad instead of
drawing. Turn it off to draw with a finger.

## Settings

Settings → Plugins → ⚙ next to this plugin. Saved in your Blinko account, so they apply on every device.

- **AI transcription:** use Blinko's Image model (default, falls back to Main), the Main model, or your own
  model just for handwriting (Gemini, OpenAI, Claude, OpenRouter, Ollama, any OpenAI-compatible URL).
  Language hint, extra instructions for the AI (abbreviations, names, date format), and a
  **Test transcription** button that sends a sample image with the current settings.
- **When you finish writing:** transcribe or just attach the image; review and edit the text before it
  goes into the note; attach the image by default; text style (plain, under a "✍️ Handwritten" heading,
  or a quote block); a tag to add (e.g. `#handwritten`).
- **Writing pad:** lined, grid, dot-grid or blank paper; line spacing; pressure sensitivity on/off;
  stylus-only default.

## Which AI model it uses

By default the plugin uses the model chosen in Blinko **Settings → AI**: the **Image model** if set,
otherwise the **Main chat model**. You can pick a different one in the plugin settings. It must accept images (for example `gemini-2.5-flash`, `gpt-4o-mini`, a Claude
model, or an Ollama vision model such as `llava`/`qwen2.5vl`).

Blinko's own AI endpoints are text-only and its image OCR is used only for embeddings, so the plugin
reads that model's provider settings through Blinko's `config.ai` API and calls the provider directly
from your browser. Supported providers: Gemini/Google, OpenAI and OpenAI-compatible (OpenRouter, xAI,
LiteLLM, custom base URL), Anthropic, Ollama. Azure OpenAI is not supported yet.

- **Ollama:** the browser calls Ollama directly, so set `OLLAMA_ORIGINS` to allow your Blinko address,
  and use the same scheme (an `https` Blinko page can't call an `http` Ollama).
- The image goes to that provider each time you transcribe; nothing is sent anywhere else.

## Install

Blinko → Settings → Plugins → install from GitHub with this repository's URL. Blinko downloads the
latest release's `release.zip`.

To publish a version: bump `version` in `plugin.json` and push to `main`. The Release workflow builds
and publishes a `v<version>` release with `release.zip` if that version isn't released yet.

## Development

```
bun install
bun test           # request builders, response parsing, ink bounds
bun run build      # → release/index.js
bun run dev        # blinko-cli dev server (Settings → Plugins → dev mode)
```

Code: `src/HandwritingPad.tsx` (pad UI), `src/strokes.ts` (ink model, PNG export),
`src/transcribe.ts` (provider calls), `src/editorTarget.ts` (finds the editor the button belongs to).
