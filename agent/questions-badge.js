// Questions of the agents on the agents page (served at /questions-badge.js, loaded by dashboard.html): a counter and
// the switch « Décider seul » in the header, a badge and a per-agent switch on each card, the count in the tab's title,
// and a browser notification when a new question comes in. Self-contained: it adds its own styles and elements.
(() => {
  const style = document.createElement('style');
  style.textContent = `
    :root { --ask: #ff8ad8; }
    .q-head { display: inline-flex; gap: 8px; align-items: center; font-size: 12px; }
    .q-count { font-size: 12px; padding: 2px 10px; border-radius: 99px; background: var(--panel2, #222933); color: var(--muted, #8b95a5);
      text-decoration: none; white-space: nowrap; border: 1px solid transparent; }
    .q-count.hot { background: var(--ask); color: #2a0b22; font-weight: 700; animation: q-glow 1.8s ease-in-out infinite; }
    .q-count:hover { text-decoration: none; border-color: var(--ask); }
    @keyframes q-glow { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--ask) 25%, transparent); } }
    .q-switch { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: var(--muted, #8b95a5); user-select: none; }
    .q-switch input { appearance: none; width: 30px; height: 17px; border-radius: 99px; background: var(--off, #5b6472); position: relative;
      cursor: pointer; transition: background .2s; margin: 0; }
    .q-switch input::after { content: ''; position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #e6e9ee; transition: left .2s; }
    .q-switch input:checked { background: var(--ok, #4cc38a); }
    .q-switch input:checked::after { left: 15px; }
    .q-switch b { color: var(--text, #e6e9ee); font-weight: 600; }
    .q-bell { font: inherit; font-size: 12px; background: none; border: 1px solid var(--line, #2e3744); color: var(--muted, #8b95a5); border-radius: 6px; padding: 1px 6px; cursor: pointer; }
    .q-badge { font-size: 12px; font-weight: 700; padding: 2px 9px; border-radius: 99px; background: var(--ask); color: #2a0b22; text-decoration: none;
      white-space: nowrap; animation: q-glow 1.8s ease-in-out infinite; }
    .q-badge.feedback { background: color-mix(in srgb, var(--ask) 25%, var(--panel2, #222933)); color: var(--ask); animation: none; font-weight: 600; }
    .q-badge:hover { text-decoration: none; filter: brightness(1.1); }
    .q-own { font: inherit; font-size: 11px; padding: 1px 7px; border-radius: 99px; border: 1px solid var(--line, #2e3744); background: none;
      color: var(--muted, #8b95a5); cursor: pointer; white-space: nowrap; }
    .q-own.asks { color: var(--ask); border-color: color-mix(in srgb, var(--ask) 50%, transparent); }
    .q-own.own { border-style: solid; font-weight: 600; }
    .card.q-waiting { box-shadow: 0 0 0 1px color-mix(in srgb, var(--ask) 55%, transparent); }`;
  document.head.append(style);

  const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
  let state = { pending: 0, unread: 0, byAgent: {}, settings: { autonomous: true, agents: {} } };
  let known = null; // ids of the pending questions already seen, to notify only the new ones

  const head = document.createElement('span');
  head.className = 'q-head';
  head.innerHTML = `<a class="q-count" href="/questions" title="Questions et retours des agents">❓ …</a>
    <label class="q-switch" title="Activé : les agents prennent l'option recommandée sans attendre (comme avant). Désactivé : ils te posent leurs choix structurants et attendent ta réponse (réponse auto au bout du délai).">
      <input type="checkbox" data-q="global"><span><b>Décider seul</b></span></label>
    <button class="q-bell" type="button" hidden title="Recevoir une notification du navigateur à chaque nouvelle question">🔔 notifier</button>`;
  const header = document.querySelector('header');
  (header.querySelector('.spacer') ?? header.lastElementChild).before(head);

  const escapeHtml = (text) => String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
  const autonomousOf = (name) => {
    const own = state.settings.agents?.[name]?.autonomous;
    return typeof own === 'boolean' ? own : state.settings.autonomous !== false;
  };

  async function saveSettings(patch) {
    const response = await fetch('/api/questions/settings', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) });
    state.settings = await response.json();
    render();
  }

  function renderCard(card) {
    const name = card.dataset.agent;
    const top = card.querySelector('.top');
    if (!name || !top) return;
    let badge = top.querySelector('.q-badge');
    let own = top.querySelector('.q-own');
    if (!own) {
      own = document.createElement('button');
      own.type = 'button';
      own.className = 'q-own';
      own.addEventListener('click', () => {
        const next = !autonomousOf(name);
        // Back to the global switch when the agent would do the same as everyone.
        saveSettings({ agents: { [name]: next === (state.settings.autonomous !== false) ? null : next } });
      });
      badge = document.createElement('a');
      badge.className = 'q-badge';
      top.querySelector('.spacer')?.before(badge, own);
    }
    const counts = state.byAgent[name] ?? { pending: 0, unread: 0 };
    const label = counts.pending
      ? `❓ ${plural(counts.pending, 'question en attente', 'questions en attente')}`
      : counts.unread
        ? `💡 ${plural(counts.unread, 'retour', 'retours')} à lire`
        : '';
    badge.hidden = !label;
    badge.textContent = label;
    badge.href = `/questions?agent=${encodeURIComponent(name)}`;
    badge.classList.toggle('feedback', !counts.pending);
    card.classList.toggle('q-waiting', counts.pending > 0);
    const alone = autonomousOf(name);
    const overridden = typeof state.settings.agents?.[name]?.autonomous === 'boolean';
    own.textContent = alone ? '🤖 décide seul' : '🙋 te demande';
    own.className = `q-own${alone ? '' : ' asks'}${overridden ? ' own' : ''}`;
    own.title = `${overridden ? 'Réglage propre à cet agent' : 'Suit le réglage global « Décider seul »'} ; clic pour ${alone ? 'qu’il te pose ses choix' : 'qu’il décide seul'}`;
  }

  function render() {
    const total = state.pending + state.unread;
    const count = head.querySelector('.q-count');
    count.classList.toggle('hot', state.pending > 0);
    count.textContent = state.pending || state.unread
      ? [state.pending && `❓ ${plural(state.pending, 'question', 'questions')}`, state.unread && `💡 ${plural(state.unread, 'retour', 'retours')}`].filter(Boolean).join(' · ')
      : '❓ aucune question';
    head.querySelector('[data-q="global"]').checked = state.settings.autonomous !== false;
    document.title = total ? `(${total}) ${baseTitle}` : baseTitle;
    for (const card of document.querySelectorAll('.card[data-agent]')) renderCard(card);
    const bell = head.querySelector('.q-bell');
    bell.hidden = !('Notification' in window) || Notification.permission !== 'default';
  }

  function notify(questions) {
    const pending = questions.filter((q) => q.status === 'pending');
    const ids = new Set(pending.map((q) => q.id));
    const fresh = known ? pending.filter((q) => !known.has(q.id)) : [];
    known = ids;
    if (!fresh.length || !('Notification' in window) || Notification.permission !== 'granted') return;
    const first = fresh[0];
    const kind = first.type === 'feedback' ? 'Retour' : first.type === 'validation' ? 'Validation' : 'Choix';
    const note = new Notification(`${kind} de ${first.agent}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`, { body: first.title, tag: 'agents-questions' });
    note.onclick = () => {
      window.focus();
      location.href = `/questions?agent=${encodeURIComponent(first.agent)}`;
    };
  }

  async function refresh() {
    try {
      const data = await (await fetch('/api/questions', { cache: 'no-store' })).json();
      state = data;
      notify(data.questions);
      render();
    } catch {}
  }

  head.querySelector('[data-q="global"]').addEventListener('change', (event) => saveSettings({ autonomous: event.target.checked }));
  head.querySelector('.q-bell').addEventListener('click', () => Notification.requestPermission().then(render));
  // Cards come and go with the dashboard's own refresh: badge the new ones as soon as they show.
  new MutationObserver(() => {
    for (const card of document.querySelectorAll('.card[data-agent]')) if (!card.querySelector('.q-own')) renderCard(card);
  }).observe(document.body, { childList: true, subtree: true });
  refresh();
  setInterval(refresh, 4000);
})();
