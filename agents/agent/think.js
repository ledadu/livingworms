// The thinking (claude --effort) and the model of an agent, made visible the same way on every page: a meter of five
// bars that fills and warms from « rapide » to « maximale », a coloured chip per model, and a picker of buttons rather
// than menus. window.Think.badge(...) and .picker(...) give HTML; a click on a picker's button calls the handler given
// to Think.onPick(root, handler) with (key, field, value). Its styles come with it.
(() => {
  const PROJECT = window.PROJECT ?? {};
  const EFFORTS = PROJECT.efforts ?? ['low', 'medium', 'high', 'xhigh', 'max'];
  const WORDS = PROJECT.effortLabels ?? { low: 'rapide', medium: 'normale', high: 'approfondie', xhigh: 'très poussée', max: 'maximale' };
  const MODELS = PROJECT.models ?? ['opus', 'sonnet', 'fable', 'haiku'];
  const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const level = (effort) => EFFORTS.indexOf(effort) + 1;
  // A known model family gets its colour (an id like claude-opus-5-5 too).
  const family = (model) => ['opus', 'sonnet', 'fable', 'haiku'].find((name) => String(model ?? '').includes(name)) ?? 'other';

  const style = document.createElement('style');
  style.textContent = `
    .tk-meter { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; vertical-align: middle; }
    .tk-meter i { width: 4px; border-radius: 1.5px; background: color-mix(in srgb, currentColor 18%, transparent); }
    .tk-meter i:nth-child(1) { height: 5px; } .tk-meter i:nth-child(2) { height: 7px; } .tk-meter i:nth-child(3) { height: 9px; } .tk-meter i:nth-child(4) { height: 11px; } .tk-meter i:nth-child(5) { height: 14px; }
    .tk-meter.none i { background: none; outline: 1px dashed color-mix(in srgb, currentColor 35%, transparent); outline-offset: -1px; }
    .tk-l1 { --tk: #6fd3c1; } .tk-l2 { --tk: #7aa7ff; } .tk-l3 { --tk: #a98bff; } .tk-l4 { --tk: #e07bff; } .tk-l5 { --tk: #ff6b9a; } .tk-l0 { --tk: #8b95a5; }
    .tk-l1 .tk-meter i:nth-child(-n+1), .tk-l2 .tk-meter i:nth-child(-n+2), .tk-l3 .tk-meter i:nth-child(-n+3), .tk-l4 .tk-meter i:nth-child(-n+4), .tk-l5 .tk-meter i:nth-child(-n+5) { background: var(--tk); }
    .tk-l5 .tk-meter i { box-shadow: 0 0 6px color-mix(in srgb, var(--tk) 60%, transparent); }
    .tk-m-opus { --m: #f2c46b; } .tk-m-sonnet { --m: #7aa7ff; } .tk-m-fable { --m: #c8b6ff; } .tk-m-haiku { --m: #4cc38a; } .tk-m-other, .tk-m-none { --m: #8b95a5; }
    .tk-badge { display: inline-flex; align-items: center; gap: 7px; padding: 3px 9px 3px 7px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--tk) 55%, transparent);
      background: linear-gradient(90deg, color-mix(in srgb, var(--tk) 16%, transparent), color-mix(in srgb, var(--m) 12%, transparent)); font-size: 12px; white-space: nowrap; color: #e8ebf0; line-height: 1.2; }
    button.tk-badge { cursor: pointer; font: inherit; font-size: 12px; }
    button.tk-badge:hover { border-color: var(--tk); box-shadow: 0 0 0 3px color-mix(in srgb, var(--tk) 18%, transparent); }
    .tk-badge .tk-word { font-weight: 650; color: var(--tk); }
    .tk-badge .tk-mod { font-weight: 650; color: var(--m); padding-left: 7px; border-left: 1px solid color-mix(in srgb, currentColor 25%, transparent); }
    .tk-badge.small { padding: 1px 7px 1px 5px; gap: 5px; font-size: 11px; }
    .tk-badge.small .tk-meter { height: 11px; } .tk-badge.small .tk-meter i { width: 3px; }
    .tk-badge.small .tk-meter i:nth-child(1) { height: 4px; } .tk-badge.small .tk-meter i:nth-child(2) { height: 5px; } .tk-badge.small .tk-meter i:nth-child(3) { height: 7px; } .tk-badge.small .tk-meter i:nth-child(4) { height: 9px; } .tk-badge.small .tk-meter i:nth-child(5) { height: 11px; }
    .tk-picker { display: flex; flex-direction: column; gap: 8px; }
    .tk-picker .tk-row { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    .tk-picker .tk-label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #8b95a5; width: 74px; flex: none; }
    .tk-opt { display: inline-flex; align-items: center; gap: 6px; padding: 5px 9px; border-radius: 8px; border: 1px solid #2a323d; background: #161b21; color: #b7bfcb; cursor: pointer; font: inherit; font-size: 12px; }
    .tk-opt:hover { border-color: var(--tk, var(--m)); color: #e8ebf0; }
    .tk-opt.on { border-color: var(--tk, var(--m)); color: #e8ebf0; background: color-mix(in srgb, var(--tk, var(--m)) 18%, #161b21); font-weight: 650; box-shadow: inset 0 -2px 0 var(--tk, var(--m)); }
    .tk-opt .tk-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--m); }
    .tk-picker.compact .tk-opt { padding: 3px 7px; } .tk-picker.compact .tk-opt .tk-w { display: none; } .tk-picker.compact .tk-label { width: auto; }
    .tk-picker.compact .tk-opt.on .tk-w { display: inline; }
    .tk-note { font-size: 11.5px; color: #8b95a5; }`;
  document.head.appendChild(style);

  const meter = (effort) => `<span class="tk-meter${effort ? '' : ' none'}" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>`;
  const word = (effort, fallback = 'défaut') => (effort ? WORDS[effort] ?? effort : fallback);

  /**
   * The badge: { effort, model }, `as`: 'span' or 'button' (then `attrs` adds its data-*), `small`, `fallback`: what an
   * unset thinking shows (« défaut », or the default it falls back to).
   */
  function badge({ effort = null, model = null } = {}, { as = 'span', attrs = '', small = false, fallback = null, title = '' } = {}) {
    const lv = effort ? level(effort) : 0;
    const shown = effort ?? fallback;
    return `<${as} class="tk-badge tk-l${lv} tk-m-${model ? family(model) : 'none'}${small ? ' small' : ''}" ${attrs} title="${esc(title || `Réflexion : ${effort ? `${word(effort)} (${effort})` : `par défaut${fallback ? ` (${fallback})` : ''}`} · modèle : ${model ?? 'par défaut'}`)}">${meter(effort)}<span class="tk-word">${esc(word(shown))}</span>${model || !small ? `<span class="tk-mod">${esc(model ?? 'défaut')}</span>` : ''}</${as}>`;
  }

  /** The picker: buttons for each thinking level and each model; `key` comes back to the handler with the field and value. */
  function picker(key, { effort = null, model = null } = {}, { compact = false, models = true, defaultLabel = 'défaut' } = {}) {
    const k = esc(key);
    const think = ['', ...EFFORTS].map((e) => `<button type="button" class="tk-opt tk-l${e ? level(e) : 0}${(effort ?? '') === e ? ' on' : ''}" data-tk-key="${k}" data-tk-field="effort" data-tk-value="${e}" title="${e ? `${word(e)} (${e})` : defaultLabel}">${meter(e)}<span class="tk-w">${esc(e ? word(e) : defaultLabel)}</span></button>`).join('');
    const mods = ['', ...MODELS].map((m) => `<button type="button" class="tk-opt tk-m-${m ? family(m) : 'none'}${(model ?? '') === m ? ' on' : ''}" data-tk-key="${k}" data-tk-field="model" data-tk-value="${esc(m)}"><span class="tk-dot"></span>${esc(m || 'défaut')}</button>`).join('');
    return `<div class="tk-picker${compact ? ' compact' : ''}"><div class="tk-row"><span class="tk-label">🧠 Réflexion</span>${think}</div>${models ? `<div class="tk-row"><span class="tk-label">Modèle</span>${mods}</div>` : ''}</div>`;
  }

  /** Calls handler(key, field, value) on a click on a picker's button inside `root` (value null for « défaut »). */
  function onPick(root, handler) {
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-tk-field]');
      if (!button || !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      const picker = button.closest('.tk-picker');
      for (const one of picker.querySelectorAll(`[data-tk-field="${button.dataset.tkField}"]`)) one.classList.toggle('on', one === button);
      handler(button.dataset.tkKey, button.dataset.tkField, button.dataset.tkValue || null);
    });
  }

  window.Think = { badge, picker, onPick, meter, word, level, EFFORTS, MODELS };
})();
