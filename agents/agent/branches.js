// A test server's link on the host the dashboard was opened from (its Tailscale name from a phone).
const localHref = (href) => String(href ?? '').replace(/^(https?:\/\/)localhost(?=[:/]|$)/, `$1${location.hostname}`);
// The « Branches » tab of the versions pages (dashboard.html, served by branches-routes.mjs): the version branches
// release/X.Y, their fixes (publish, report to backlog), rebase and deletion, and the test servers of versions.
// Read from /api/branches; redrawn only when its content changes, never while one of its fields is being used.
let branchesData = null;
let branchesKey = '';
const branchBusy = new Map(); // key → label of the action under way
const fixPicks = new Map(); // branch → Set of the shas left unticked

const shortTime = (ms) => (ms ? ago(ms) : '—');

function versusPill(side) {
  if (!side) return '';
  const text = side.ahead || side.behind ? `+${side.ahead} / −${side.behind}` : 'à égalité';
  return `<span title="commits en avance / en retard sur ${escapeHtml(side.ref)}">${escapeHtml(side.ref)} <b>${text}</b></span>`;
}

function busyButton(key, label, attributes, title = '', kind = 'btn') {
  const working = branchBusy.get(key);
  return `<button class="${kind}" ${attributes} ${working ? 'disabled' : ''} title="${escapeHtml(title)}">${working ? `<span class="spin"></span>${escapeHtml(working)}` : label}</button>`;
}

function serverRow(server) {
  const key = `server:${server.name}`;
  const running = server.server || server.client;
  return `<div class="server">
    <span><span class="dot ${server.server ? 'on' : ''}"></span>serveur ${server.serverPort}</span>
    <span><span class="dot ${server.client ? 'on' : ''}"></span>client ${server.clientPort}</span>
    <span class="pill">${escapeHtml(server.name)}</span>
    <span class="sha">${escapeHtml(server.head ?? '—')}</span>
    ${server.stale ? `<span class="pill warn" title="${escapeHtml(server.ref)} a avancé depuis">à actualiser</span>` : ''}
    <span class="spacer"></span>
    ${running ? `<a class="btn primary" href="${escapeHtml(localHref(server.url))}" target="_blank">▶ Ouvrir</a>` : busyButton(key, '▶ Démarrer', `data-baction="serve" data-ref="${escapeHtml(server.ref)}"`)}
    ${server.stale ? busyButton(`${key}:refresh`, '⟳ Actualiser', `data-baction="refresh" data-name="${escapeHtml(server.name)}"`, `Remet le worktree sur ${server.ref}`) : ''}
    ${running ? busyButton(`${key}:stop`, '■ Arrêter', `data-baction="stop" data-name="${escapeHtml(server.name)}"`) : ''}
    ${busyButton(`${key}:remove`, '🗑', `data-baction="remove" data-name="${escapeHtml(server.name)}"`, 'Supprimer ce serveur (worktree et copie de la base)')}
  </div>`;
}

function fixList(branch) {
  const unticked = fixPicks.get(branch.branch) ?? new Set();
  const waiting = branch.fixes.filter((fix) => !fix.reported);
  const done = branch.fixes.filter((fix) => fix.reported).slice(-4);
  if (!branch.fixes.length) return '<div class="empty">Aucun commit depuis la __RELEASE__ : rien à reporter.</div>';
  const item = (fix) => `<li class="${fix.reported ? 'done' : ''}">
    ${fix.reported ? '<span title="déjà dans __INTEGRATION__">✓</span>' : `<input type="checkbox" data-fix="${escapeHtml(branch.branch)}" value="${escapeHtml(fix.sha)}"${unticked.has(fix.sha) ? '' : ' checked'}>`}
    <span class="sha">${escapeHtml(fix.short)}</span>
    <span class="txt" title="${escapeHtml(fix.subject)}">${fix.release ? `🏷 ${escapeHtml(fix.subject)} <span class="note">(sa __RELEASE__ et le changelog)</span>` : escapeHtml(fix.subject)}</span>
  </li>`;
  return `<ul class="fixes">${[...waiting, ...done].map(item).join('')}</ul>
    ${waiting.length ? `<div class="row">${busyButton(`report:${branch.line}`, `↪ Reporter vers ${escapeHtml(branch.integration?.ref ?? '__INTEGRATION__')}`, `data-baction="report" data-line="${escapeHtml(branch.line)}"`, 'cherry-pick -x des commits cochés dans un worktree temporaire, puis avance backlog (fast-forward)')}
      <label class="note"><input type="checkbox" data-advance="${escapeHtml(branch.line)}" checked> avancer ${escapeHtml(branch.integration?.ref ?? '__INTEGRATION__')} (sinon, une branche report/…)</label></div>` : ''}`;
}

function patchPanel(branch) {
  const { patch: next } = branch;
  if (!next.entries.length) return `<div class="empty">Rien à publier : un correctif arrive avec son entrée <code>fixed</code> dans <code>__CHANGES__/unreleased/</code>, puis se publie ici en ${escapeHtml(next.version)}.</div>`;
  const ready = !next.problems.length;
  return `${next.entries.length ? `<ul class="fixes">${next.entries.map((entry) => `<li><span class="badge" style="--status:${entry.type === 'fixed' ? 'var(--warn)' : 'var(--bad)'}">${escapeHtml(entry.badge ?? entry.type ?? '?')}</span><span class="txt">${escapeHtml(entry.title ?? entry.slug)}</span><span class="pill">${escapeHtml(entry.slug)}</span></li>`).join('')}</ul>` : ''}
    ${next.problems.length ? `<ul class="problems">${next.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join('')}</ul>` : ''}
    <div class="row"><input type="text" data-patch-version="${escapeHtml(branch.line)}" value="${escapeHtml(next.version)}" title="X.Y.Z, Z > 0" style="min-width:80px;width:80px">
      <button class="btn publish small" data-baction="publish" data-line="${escapeHtml(branch.line)}" ${ready && !branchBusy.get(`publish:${branch.line}`) ? '' : 'disabled'} title="Dans un worktree temporaire sur ${escapeHtml(branch.branch)} : commit des seuls chemins de la publication et tag, sans push">${branchBusy.get(`publish:${branch.line}`) ? '<span class="spin"></span>Publication…' : `🚀 Publier la ${escapeHtml(next.generation)}`}</button></div>`;
}

function branchCard(branch) {
  const todo = branch.toReport > 0 || branch.patch.entries.length > 0;
  const state = branch.diverged ? 'diverged' : todo ? 'todo' : '';
  return `<section class="card rbranch ${state}">
    <div class="top"><span class="name">${escapeHtml(branch.branch)}</span>
      ${branch.tag ? `<span class="pill ok" title="dernier tag de la ligne sur la branche">${escapeHtml(branch.tag)}${branch.exact ? '' : ` +${branch.unpublished}`}</span>` : '<span class="pill warn">sans tag</span>'}
      ${branch.diverged ? `<span class="pill bad" title="la branche ne contient plus ${escapeHtml(branch.baseTag ?? `v${branch.line}.0`)}">divergée</span>` : ''}
      ${branch.strayTag ? `<span class="pill warn" title="publié hors de cette branche">${escapeHtml(branch.strayTag)} hors branche</span>` : ''}
      <span class="spacer"></span><span class="note">${escapeHtml(branch.generation)}</span></div>
    <div class="stats">${versusPill(branch.integration)}${versusPill(branch.main)}
      ${branch.toReport ? `<span class="stale"><b>${branch.toReport}</b> à reporter</span>` : '<span class="fresh">tout est reporté</span>'}
      ${branch.checkedOut ? `<span class="stale" title="${escapeHtml(branch.checkedOut)}">extraite dans un worktree</span>` : ''}</div>
    ${branch.last ? `<ul class="commits"><li><span class="sha">${escapeHtml(branch.last.short)}</span><span class="txt" title="${escapeHtml(branch.last.subject)}">${escapeHtml(branch.last.subject)}</span><span class="when">${shortTime(branch.last.time)}</span></li></ul>` : ''}
    <h4>Correctifs absents de ${escapeHtml(branch.integration?.ref ?? '__INTEGRATION__')}</h4>
    ${fixList(branch)}
    <h4>Correction à publier</h4>
    ${patchPanel(branch)}
    <h4>Intégrer une branche de correctif</h4>
    <div class="row"><input type="text" data-integrate="${escapeHtml(branch.line)}" placeholder="agent/fix-… partie de ${escapeHtml(branch.branch)}">
      ${busyButton(`integrate:${branch.line}`, '⤵ Intégrer', `data-baction="integrate" data-line="${escapeHtml(branch.line)}"`, `Fusionne la branche dans ${branch.branch} (worktree temporaire)`)}</div>
    <h4>Serveurs de test</h4>
    <div class="servers">${branch.servers.map(serverRow).join('') || '<div class="empty">Aucun serveur pour cette version.</div>'}</div>
    <div class="actions">
      ${branch.servers.length ? '' : busyButton(`server:${branch.branch}`, `▶ Lancer un serveur ${escapeHtml(branch.line)}`, `data-baction="serve" data-ref="${escapeHtml(branch.branch)}"`, 'Worktree de la branche, ses ports et sa copie de la base, puis démarrage')}
      <span class="spacer"></span>
      ${busyButton(`rebase:${branch.line}`, '⟳ Rebaser…', `data-baction="rebase" data-line="${escapeHtml(branch.line)}" data-tag="${escapeHtml(branch.latest ?? '')}"`, 'Rejoue la branche sur son tag ou sur une base choisie, dans un worktree temporaire')}
      ${busyButton(`delete:${branch.line}`, '🗑 Supprimer la branche', `data-baction="delete" data-line="${escapeHtml(branch.line)}"`, 'Supprime la branche (les tags restent)', 'btn danger')}
    </div>
  </section>`;
}

function branchesView() {
  const data = branchesData;
  const help = `<div class="flowhelp">Une __RELEASE__ <b>X.Y.0</b> publiée ouvre sa branche <code>release/X.Y</code> au tag. Ses correctifs :
    <b>1.</b> <code>make agent-new NAME=fix-… BASE=release/X.Y</code>, le correctif et une entrée <code>fixed</code> dans <code>__CHANGES__/unreleased/</code> ;
    <b>2.</b> « Intégrer » la branche ici ; <b>3.</b> « Publier la __Release__ X.Y.Z » (tag sur la branche) ;
    <b>4.</b> « Reporter vers __INTEGRATION__ ». Rien n'est poussé ; tout se fait dans des worktrees temporaires.</div>`;
  const missing = data.missing.length
    ? `<div class="bulk">${data.missing.map((line) => `<span class="note">La __Release__ ${escapeHtml(line)} est publiée sans branche.</span>${busyButton(`create:${line}`, `🌱 Créer release/${escapeHtml(line)}`, `data-baction="create" data-line="${escapeHtml(line)}"`, `Depuis le tag v${line}.0`)}`).join('')}</div>`
    : '';
  const tagOptions = data.tags.map((tag) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
  const tagServers = `<div class="panel" style="margin-top:14px"><h3>Serveurs sur un tag</h3>
    <div class="servers">${data.tagServers.map(serverRow).join('') || '<div class="empty">Aucun.</div>'}</div>
    ${tagOptions ? `<div class="row actions"><select class="assign" id="tag-server">${tagOptions}</select>${busyButton('server:tag', '▶ Lancer un serveur sur ce tag', 'data-baction="serve-tag"')}</div>` : ''}</div>`;
  const cards = data.branches.length ? `<div class="branches">${data.branches.map(branchCard).join('')}</div>` : '<div class="empty">Aucune branche de version : la prochaine __RELEASE__ X.Y.0 publiée en ouvrira une.</div>';
  return `<div class="vhead"><h2>Branches de version</h2><span class="note">${data.branches.length} branche(s) · ${data.servers} serveur(s) de test</span></div>
    ${data.error ? `<ul class="problems"><li>${escapeHtml(data.error)}</li></ul>` : ''}${help}${missing}${cards}${tagServers}`;
}

window.renderBranches = function renderBranches(force = false) {
  if (!branchesData) return;
  document.getElementById('count-branches').textContent = String(branchesData.branches.length || '');
  if (currentTab !== 'branches') return;
  const view = document.getElementById('view-branches');
  const active = document.activeElement;
  if (!force && view.contains(active) && active !== document.body && active.tagName !== 'BUTTON' && active.tagName !== 'A') return;
  patch(view, branchesView());
};

async function refreshBranches() {
  try {
    const data = await (await fetch('/api/branches', { cache: 'no-store' })).json();
    const key = JSON.stringify(data);
    if (key === branchesKey) return;
    branchesKey = key;
    branchesData = data;
    window.renderBranches();
  } catch {}
}

async function branchAction(key, label, action, body) {
  branchBusy.set(key, label);
  window.renderBranches(true);
  let result;
  try {
    result = await (await fetch(`/api/branches/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  } catch (error) {
    result = { ok: false, error: `Échec : ${error.message}` };
  }
  branchBusy.delete(key);
  if (!result.ok && !result.rewritten) setBanner('bad', result.error);
  else if (result.ok) setBanner('ok', result.message ?? 'Fait.');
  branchesKey = '';
  await refreshBranches();
  window.renderBranches(true);
  // The versions tabs change too (a publication, a carried generation).
  versionsKey = '';
  refreshVersions();
  return result;
}

// Opens the tab at once (a tab opened after an await is blocked as a popup), then points it at the client once up.
async function serve(ref, key) {
  const tab = window.open('about:blank', '_blank');
  tab?.document.write(`<title>${escapeHtml(ref)}</title><body style="background:#111418;color:#e6e9ee;font:15px system-ui;padding:24px">Démarrage d'un serveur ${escapeHtml(ref)}… (compte de test : banc / banc-essai-1)</body>`);
  const result = await branchAction(key, 'Démarrage…', 'serve', { ref });
  if (result.ok && tab) tab.location.href = localHref(result.url);
  else tab?.close();
}

document.addEventListener('change', (event) => {
  const box = event.target.closest('input[data-fix]');
  if (!box) return;
  const unticked = fixPicks.get(box.dataset.fix) ?? new Set();
  box.checked ? unticked.delete(box.value) : unticked.add(box.value);
  fixPicks.set(box.dataset.fix, unticked);
});

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-baction]');
  if (!target) return;
  event.preventDefault();
  const { baction, line, name, ref } = target.dataset;
  const branch = branchesData?.branches.find((candidate) => candidate.line === line);
  if (baction === 'create') return branchAction(`create:${line}`, 'Création…', 'create', { line });
  if (baction === 'serve') return serve(ref, `server:${ref}`);
  if (baction === 'serve-tag') return serve(document.getElementById('tag-server').value, 'server:tag');
  if (baction === 'refresh') return branchAction(`server:${name}:refresh`, 'Actualisation…', 'refresh', { name });
  if (baction === 'stop') return branchAction(`server:${name}:stop`, 'Arrêt…', 'stop', { name });
  if (baction === 'remove') {
    if (!confirm(`Supprimer le serveur de test ${name} ? Son worktree et sa copie de la base sont effacés.`)) return;
    return branchAction(`server:${name}:remove`, 'Suppression…', 'remove', { name });
  }
  if (baction === 'report') {
    const shas = [...document.querySelectorAll(`input[data-fix="${CSS.escape(branch.branch)}"]:checked`)].map((box) => box.value);
    if (!shas.length) return setBanner('bad', 'Coche au moins un correctif à reporter.');
    const advance = document.querySelector(`input[data-advance="${CSS.escape(line)}"]`)?.checked !== false;
    const onto = branch.integration?.ref ?? '__INTEGRATION__';
    if (!confirm(`Reporter ${shas.length} commit(s) de ${branch.branch} vers ${onto} ?\n\nChacun est cherry-pické (-x) dans un worktree temporaire ; une publication y apporte sa __RELEASE__ et le changelog. Un conflit annule tout.${advance ? `\n\nPuis ${onto} avance (fast-forward) : si ${onto} est extraite dans le dépôt principal, seuls les fichiers des correctifs y changent, et git refuse s'ils sont en cours de modification.` : ''}`)) return;
    const result = await branchAction(`report:${line}`, 'Report…', 'report', { line, shas, advance });
    if (result.ok) fixPicks.delete(branch.branch);
    return;
  }
  if (baction === 'publish') {
    const version = document.querySelector(`input[data-patch-version="${CSS.escape(line)}"]`)?.value.trim() || branch.patch.version;
    const list = branch.patch.entries.map((entry) => `  • ${entry.title ?? entry.slug}`).join('\n');
    if (!confirm(`Publier la __Release__ ${version} sur ${branch.branch} ?\n\n${list}\n\nDans un worktree temporaire sur la branche : ces entrées passent dans __CHANGES__/v${version}/, versions et CHANGELOG.md mis à jour, commit de ces seuls chemins et tag v${version}. Pas de push. Reporte-la ensuite vers backlog.`)) return;
    return branchAction(`publish:${line}`, 'Publication…', 'publish', { line, version });
  }
  if (baction === 'integrate') {
    const input = document.querySelector(`input[data-integrate="${CSS.escape(line)}"]`);
    const refName = input?.value.trim();
    if (!refName) return setBanner('bad', 'Indique la branche du correctif (ex. agent/fix-…).');
    return branchAction(`integrate:${line}`, 'Fusion…', 'integrate', { line, ref: refName });
  }
  if (baction === 'rebase') {
    const onto = prompt(`Rebaser ${branch.branch} sur (tag, branche ou commit) :`, target.dataset.tag || `v${line}.0`);
    if (!onto) return;
    let result = await branchAction(`rebase:${line}`, 'Rebase…', 'rebase', { line, onto });
    if (!result.ok && result.rewritten && confirm(`${result.error}\n\nForcer le rebase ?`)) result = await branchAction(`rebase:${line}`, 'Rebase…', 'rebase', { line, onto, force: true });
    else if (!result.ok && result.rewritten) setBanner('bad', result.error);
    return;
  }
  if (baction === 'delete') {
    const warn = branch.toReport ? `\n\n⚠ ${branch.toReport} correctif(s) ne sont pas dans ${branch.integration?.ref ?? '__INTEGRATION__'}.` : '';
    if (!confirm(`Supprimer la branche ${branch.branch} ?${warn}\n\nLes tags restent ; le message final donne la commande pour la recréer.`)) return;
    return branchAction(`delete:${line}`, 'Suppression…', 'delete', { line });
  }
});

refreshBranches();
setInterval(refreshBranches, 5000);
