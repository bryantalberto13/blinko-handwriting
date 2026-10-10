/** Scoped styles. Blinko's Tailwind is precompiled, so plugin UI can't rely on utility classes. */
export const CSS = `
.hw-pad{--hw-accent:#f97316;--hw-line:rgba(128,128,128,.3);display:flex;flex-direction:column;gap:10px;
  height:min(82vh,1200px);font-size:14px;line-height:1.4;color:inherit}
.hw-pad *{box-sizing:border-box}
.hw-pad button{font:inherit;color:inherit;cursor:pointer}
.hw-pad button:disabled{opacity:.45;cursor:default}
.hw-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.hw-group{display:flex;gap:4px;align-items:center}
.hw-tool{min-width:38px;height:38px;padding:0 10px;border:1px solid var(--hw-line);border-radius:10px;background:transparent;
  display:inline-flex;align-items:center;justify-content:center}
.hw-tool.on{border-color:var(--hw-accent);box-shadow:0 0 0 1px var(--hw-accent) inset}
.hw-dot{width:18px;height:18px;border-radius:50%;border:1px solid var(--hw-line)}
.hw-line{width:20px;border-radius:4px;background:currentColor}
.hw-check{display:inline-flex;gap:6px;align-items:center;cursor:pointer;user-select:none}
.hw-scroll{flex:1 1 auto;min-height:0;overflow-y:auto;border:1px solid var(--hw-line);border-radius:12px}
.hw-paper{position:relative;width:100%}
.hw-paper canvas{position:absolute;inset:0;display:block;touch-action:none;cursor:crosshair;-webkit-user-select:none;user-select:none}
.hw-paper canvas.erasing{cursor:cell}
.hw-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.hw-msg{flex:1 1 200px;min-width:0}
.hw-busy{opacity:.75}
.hw-err{color:#ef4444}
.hw-btn{background:var(--hw-accent);color:#fff !important;border:0;border-radius:10px;padding:9px 16px;font-weight:600}
.hw-btn.ghost{background:transparent;color:inherit !important;border:1px solid var(--hw-line);font-weight:500}

.hw-review{flex:1 1 auto;display:flex;flex-direction:column;gap:6px;min-height:0}
.hw-review textarea{flex:1 1 auto;min-height:200px;font:inherit;color:inherit;background:transparent;border:1px solid var(--hw-line);
  border-radius:12px;padding:12px;resize:vertical;outline:none}
.hw-lbl{font-weight:600}
.hw-set{--hw-accent:#f97316;--hw-line:rgba(128,128,128,.3);display:flex;flex-direction:column;gap:18px;font-size:14px;line-height:1.4;
  max-height:70vh;overflow-y:auto;padding:2px 4px 4px}
.hw-set *{box-sizing:border-box}
.hw-set h3{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;opacity:.6;margin:0 0 8px}
.hw-set section{display:flex;flex-direction:column;gap:10px}
.hw-set .hw-field{display:flex;flex-direction:column;gap:4px}
.hw-set .hw-field>span{font-weight:600}
.hw-set .hw-hint{font-size:12px;opacity:.6}
.hw-set input[type=text],.hw-set input[type=password],.hw-set select,.hw-set textarea{width:100%;font:inherit;color:inherit;
  background:transparent;border:1px solid var(--hw-line);border-radius:10px;padding:8px 10px;outline:none}
.hw-set select option{color:#111}
.hw-set textarea{min-height:70px;resize:vertical}
.hw-set input:focus,.hw-set select:focus,.hw-set textarea:focus{border-color:var(--hw-accent)}
.hw-set input[type=range]{width:100%;accent-color:var(--hw-accent)}
.hw-set .hw-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.hw-set button{font:inherit;color:inherit;cursor:pointer}
.hw-set button:disabled{opacity:.45;cursor:default}
.hw-set .hw-ok{color:#16a34a;white-space:pre-wrap}
.hw-set .hw-err{color:#ef4444}
`;
