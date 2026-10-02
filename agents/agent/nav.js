// The navigation of every page of the dashboard: the workflow itself, as the home map tells it. Four stages with their
// live counts, Backlog → Agents → À valider → Publier, then « Pour toi » (what waits for the user's gesture), the
// Journal and the notifications; the name goes back to the map. On a phone the stages become a tab bar at the bottom.
// It replaces the old row of links (nav.site), which stays as it was if this script fails. Counts: /api/nav and
// /api/versions, every 10 s while the page is visible.
(() => {
  if (window.__workflowNav) return;
  window.__workflowNav = true;
  const PROJECT = window.PROJECT ?? {};
  const esc = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let here = location.pathname;
  let params = new URLSearchParams(location.search);
  const STAGES = [
    { key: 'backlog', n: 1, icon: '📋', label: 'Backlog', href: '/roadmap', color: '#c8b6ff', active: () => here.startsWith('/roadmap') },
    { key: 'agents', n: 2, icon: '🤖', label: 'Agents', href: '/agents', color: '#7aa7ff', active: () => here.startsWith('/agents') && params.get('f') !== 'review' },
    { key: 'validate', n: 3, icon: '✋', label: 'À valider', href: '/agents?f=review', color: '#ffb547', active: () => here.startsWith('/agents') && params.get('f') === 'review' },
    { key: 'publish', n: 4, icon: '📦', label: 'Publier', href: '/versions', color: '#4cc38a', active: () => here.startsWith('/versions') },
  ];

  const style = document.createElement('style');
  style.textContent = `
    nav.site { display: none !important; }
    .wf { position: relative; z-index: 30; display: flex; align-items: center; gap: 14px; padding: 8px 18px; background: #0b0e12; border-bottom: 1px solid #222a34; font: 14px/1.3 system-ui, -apple-system, Segoe UI, sans-serif; color: #e8ebf0; }
    .wf a { color: inherit; text-decoration: none; }
    .wf-home { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; white-space: nowrap; padding: 4px 8px; border-radius: 8px; }
    .wf-home:hover, .wf-home.on { background: #1d232b; }
    .wf-home small { font-weight: 400; color: #7f8a99; font-size: 11.5px; }
    .wf-flow { display: flex; align-items: stretch; gap: 0; flex: 1; justify-content: center; min-width: 0; }
    .wf-stage { --c: #7aa7ff; position: relative; display: flex; align-items: center; gap: 9px; padding: 5px 14px 5px 10px; border-radius: 10px; border: 1px solid transparent; min-width: 0; transition: background .15s, border-color .15s; }
    .wf-stage:hover { background: color-mix(in srgb, var(--c) 9%, transparent); border-color: color-mix(in srgb, var(--c) 30%, transparent); }
    .wf-stage.on { background: color-mix(in srgb, var(--c) 15%, #11161c); border-color: color-mix(in srgb, var(--c) 60%, transparent); box-shadow: inset 0 -2px 0 var(--c); }
    .wf-num { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #0b0e12; background: var(--c); flex: none; }
    .wf-txt { display: flex; flex-direction: column; min-width: 0; }
    .wf-txt b { font-size: 13.5px; white-space: nowrap; }
    .wf-txt small { font-size: 11.5px; color: #8b95a5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .wf-txt small em { font-style: normal; color: var(--c); font-weight: 600; }
    .wf-badge { position: absolute; top: -6px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; font-size: 11px; font-weight: 700; display: grid; place-items: center; color: #0b0e12; background: var(--c); box-shadow: 0 0 0 2px #0b0e12; }
    .wf-badge[hidden] { display: none !important; }
    .wf-badge.hot { animation: wf-pulse 1.6s infinite; }
    .wf-badge.bad { background: #ef6b6b; }
    @keyframes wf-pulse { 0% { box-shadow: 0 0 0 2px #0b0e12, 0 0 0 2px color-mix(in srgb, var(--c) 70%, transparent); } 100% { box-shadow: 0 0 0 2px #0b0e12, 0 0 0 9px transparent; } }
    .wf-arrow { align-self: center; color: #3a4452; font-size: 14px; padding: 0 2px; }
    .wf-side { display: flex; align-items: center; gap: 4px; }
    .wf-icon { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; border: 1px solid transparent; color: #b7bfcb; background: none; cursor: pointer; font: inherit; font-size: 13px; white-space: nowrap; }
    .wf-icon:hover, .wf-icon.on { background: #1d232b; border-color: #2a323d; color: #e8ebf0; }
    .wf-icon .wf-badge { --c: #ff8ad8; }
    .wf-for { --c: #ff8ad8; }
    .wf-panel { position: absolute; right: 12px; top: calc(100% + 6px); width: min(440px, calc(100vw - 24px)); background: #161b21; border: 1px solid #36404d; border-radius: 12px; box-shadow: 0 16px 40px rgba(0, 0, 0, .5); padding: 8px; z-index: 60; display: none; }
    .wf-panel.open { display: block; }
    .wf-panel h4 { margin: 4px 8px 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #b7bfcb; }
    .wf-item { --c: #8b95a5; display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; padding: 8px; border-radius: 8px; border-left: 3px solid var(--c); margin-bottom: 4px; background: color-mix(in srgb, var(--c) 7%, transparent); }
    .wf-item:hover { background: color-mix(in srgb, var(--c) 14%, transparent); }
    .wf-item b { font-family: ui-monospace, monospace; font-size: 12.5px; }
    .wf-item small { display: block; color: #8b95a5; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wf-item.question { --c: #ff8ad8; } .wf-item.error { --c: #ef6b6b; } .wf-item.review { --c: #ffb547; } .wf-item.publish { --c: #4cc38a; } .wf-item.chat { --c: #7aa7ff; } .wf-item.feedback { --c: #c8b6ff; }
    .wf-calm { color: #8b95a5; font-size: 13px; padding: 10px; }
    .wf-tabs { display: none; }
    @media (max-width: 860px) {
      .wf { padding: 6px 12px; gap: 8px; }
      .wf-flow { display: none; }
      .wf-home small, .wf-icon .wf-l { display: none; }
      .wf-side { margin-left: auto; }
      .wf-tabs { display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; left: 0; right: 0; bottom: 0; z-index: 50; background: #0b0e12; border-top: 1px solid #222a34; padding: 4px 4px calc(4px + env(safe-area-inset-bottom)); }
      .wf-tab { --c: #7aa7ff; position: relative; display: flex; flex-direction: column; align-items: center; gap: 1px; padding: 5px 2px; border-radius: 10px; color: #8b95a5; font-size: 11px; text-decoration: none; }
      .wf-tab span:first-child { font-size: 19px; line-height: 1.1; }
      .wf-tab.on { color: #e8ebf0; background: color-mix(in srgb, var(--c) 16%, transparent); }
      .wf-tab .wf-badge { top: 0; right: calc(50% - 22px); }
      body { padding-bottom: calc(64px + env(safe-area-inset-bottom)) !important; }
      .pickbar { bottom: calc(76px + env(safe-area-inset-bottom)) !important; }
      .toast { bottom: calc(76px + env(safe-area-inset-bottom)) !important; }
    }`;
  document.head.appendChild(style);

  const bar = document.createElement('div');
  bar.className = 'wf';
  bar.setAttribute('role', 'navigation');
  bar.setAttribute('aria-label', 'Le parcours');
  const stageHtml = (stage) => `<a class="wf-stage${stage.active() ? ' on' : ''}" href="${stage.href}" style="--c:${stage.color}" data-wf="${stage.key}">
      <span class="wf-num">${stage.n}</span><span class="wf-txt"><b>${stage.icon} ${stage.label}</b><small data-wf-sub="${stage.key}">…</small></span><span class="wf-badge" data-wf-badge="${stage.key}" hidden></span></a>`;
  bar.innerHTML = `<a class="wf-home${here === '/' || here === '/hub' ? ' on' : ''}" href="/" title="La carte de l'écosystème">🧬 ${esc(PROJECT.name ?? 'Projet')} <small>la carte</small></a>
    <div class="wf-flow">${STAGES.map(stageHtml).join('<span class="wf-arrow">→</span>')}</div>
    <div class="wf-side">
      <button class="wf-icon wf-for" type="button" data-wf-for title="Ce qui attend ton geste">📥 <span class="wf-l">Pour toi</span><span class="wf-badge" data-wf-badge="for" hidden></span></button>
      <a class="wf-icon${here.startsWith('/journal') ? ' on' : ''}" href="/journal" title="Le journal : commits et rapports">🕘 <span class="wf-l">Journal</span></a>
      <a class="wf-icon${here.startsWith('/questions') ? ' on' : ''}" href="/questions" title="Les questions des agents">❓<span class="wf-badge" data-wf-badge="questions" hidden></span></a>
      <a class="wf-icon${here.startsWith('/notifications') ? ' on' : ''}" href="/notifications" title="Les notifications sur ton téléphone">🔔</a>
    </div>
    <div class="wf-panel" data-wf-panel></div>`;
  document.body.prepend(bar);
  const tabs = document.createElement('nav');
  tabs.className = 'wf-tabs';
  tabs.innerHTML = STAGES.map((stage) => `<a class="wf-tab${stage.active() ? ' on' : ''}" href="${stage.href}" style="--c:${stage.color}"><span>${stage.icon}</span><span>${stage.label}</span><span class="wf-badge" data-wf-badge="${stage.key}" hidden></span></a>`).join('');
  document.body.appendChild(tabs);

  // A page that changes its address in place (the Agents page's filters) tells it: the current stage follows.
  window.addEventListener('wf:route', () => {
    here = location.pathname;
    params = new URLSearchParams(location.search);
    for (const stage of STAGES) for (const el of document.querySelectorAll(`.wf-stage[data-wf="${stage.key}"], .wf-tab[href="${stage.href}"]`)) el.classList.toggle('on', stage.active());
  });
  const panel = bar.querySelector('[data-wf-panel]');
  bar.querySelector('[data-wf-for]').addEventListener('click', (event) => {
    event.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-wf-panel]')) panel.classList.remove('open');
  });
  document.addEventListener('keydown', (event) => event.key === 'Escape' && panel.classList.remove('open'));

  const setBadge = (key, n, { hot = false, bad = false } = {}) => {
    for (const el of document.querySelectorAll(`[data-wf-badge="${key}"]`)) {
      el.hidden = !n;
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.toggle('hot', hot && n > 0);
      el.classList.toggle('bad', bad && n > 0);
    }
  };
  const sub = (key, html) => {
    const el = bar.querySelector(`[data-wf-sub="${key}"]`);
    if (el) el.innerHTML = html;
  };
  const ICON = { question: '❓', feedback: '💬', error: '⚠', review: '✋', publish: '📦', chat: '✉' };
  const WORD = { question: 'te pose une question', feedback: 'te laisse un mot', error: 's’est arrêté en erreur', review: 'a fini : à tester et accepter', chat: 'a répondu' };

  async function refresh() {
    let nav;
    let versions = null;
    try {
      [nav, versions] = await Promise.all([fetch('/api/nav', { cache: 'no-store' }).then((r) => r.json()), fetch('/api/versions', { cache: 'no-store' }).then((r) => r.json()).catch(() => null)]);
    } catch {
      return;
    }
    if (!nav?.ok) return;
    const pending = versions?.pending?.length ?? 0;
    const planned = versions?.planned?.[0];
    sub('backlog', `${nav.backlog.todo} à faire${nav.backlog.news ? ` · <em>${nav.backlog.news} nouveaux</em>` : ''}`);
    sub('agents', nav.agents.working || nav.agents.queued ? `${nav.agents.working ? `<em>${nav.agents.working} au travail</em>` : ''}${nav.agents.working && nav.agents.queued ? ' · ' : ''}${nav.agents.queued ? `${nav.agents.queued} en file` : ''}` : 'personne au travail');
    sub('validate', nav.validate.review || nav.validate.error ? `${nav.validate.review ? `<em>${nav.validate.review} à accepter</em>` : ''}${nav.validate.review && nav.validate.error ? ' · ' : ''}${nav.validate.error ? `<em style="color:#ef6b6b">${nav.validate.error} en erreur</em>` : ''}` : 'rien à valider');
    sub('publish', `${pending ? `<em>${pending} à ranger</em>` : ''}${pending && planned ? ' · ' : ''}${planned ? `${esc(planned.generation ?? planned.version)} : ${planned.entries?.length ?? 0}` : pending ? '' : 'rien en attente'}`);
    setBadge('agents', nav.agents.working);
    setBadge('validate', nav.validate.review + nav.validate.error, { hot: true, bad: nav.validate.error > 0 });
    setBadge('publish', pending, { hot: true });
    const questions = nav.forYou.filter((one) => one.kind === 'question').length;
    setBadge('questions', questions, { hot: true });
    const items = [...nav.forYou];
    if (pending) items.push({ kind: 'publish', agent: `${pending} entrée${pending > 1 ? 's' : ''}`, title: 'à ranger dans une version, puis publier', url: '/versions?tab=pending' });
    setBadge('for', items.filter((one) => one.kind !== 'feedback').length, { hot: true, bad: nav.validate.error > 0 });
    panel.innerHTML = `<h4>Pour toi</h4>${items.map((one) => `<a class="wf-item ${one.kind}" href="${esc(one.url)}"><span>${ICON[one.kind] ?? '•'}</span><span><b>${esc(one.agent ?? '')}</b> ${esc(WORD[one.kind] ?? '')}<small>${esc(one.title ?? '')}${one.detail ? ` — ${esc(one.detail)}` : ''}</small></span></a>`).join('') || '<div class="wf-calm">Rien ne t’attend. Les agents travaillent, ou tout est rangé.</div>'}`;
  }
  refresh();
  setInterval(() => document.visibilityState === 'visible' && refresh(), 10_000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && refresh());
})();
