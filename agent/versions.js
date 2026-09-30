// The versions tabs of the agents' dashboard (dashboard.html, served by versions.mjs): « À publier », one tab per
// generation in preparation, « Publiées ».
// Read from /api/versions (the changes folder and its planned.json of the repository the dashboard runs from). A view is
// redrawn only when its content changes, and never while one of its fields is being edited.
let versions = null;
let versionsKey = '';
const dirtyForms = new Set(); // versions whose form holds unsaved edits
let banner = null; // { kind: 'ok' | 'bad', text }
const selected = new Set(); // entries of « À publier » chosen for a grouped action
// An entry that can be published: present and valid.
const publishable = (entry) => !entry.missing && !entry.errors.length;

function setBanner(kind, text) {
  banner = text ? { kind, text } : null;
  const element = document.getElementById('view-banner');
  element.hidden = !banner || currentTab === 'active';
  element.innerHTML = banner ? `<div class="banner ${banner.kind}">${escapeHtml(banner.text)} <a href="#" data-vaction="close-banner">✕</a></div>` : '';
}

function assignSelect(entry, current) {
  const options = versions.planned
    .filter((planned) => planned.version !== current)
    .map((planned) => `<option value="${escapeHtml(planned.version)}">${current ? 'Déplacer vers' : 'Affecter à'} la ${escapeHtml(planned.generation)}</option>`);
  const proposal = entry.propose && !versions.planned.some((planned) => planned.version === entry.propose) ? entry.propose : null;
  if (proposal) options.push(`<option value="${escapeHtml(proposal)}">${current ? 'Déplacer vers' : 'Affecter à'} une nouvelle version (${escapeHtml(proposal)})</option>`);
  options.push('<option value="?">… une autre version (numéro à saisir)</option>');
  if (current) options.push('<option value="-">Retirer de la __RELEASE__</option>');
  return `<select class="assign" data-assign="${escapeHtml(entry.slug)}"><option value="">${current ? 'Déplacer / retirer…' : 'Affecter à…'}</option>${options.join('')}</select>`;
}

function entryCard(entry, { current = null, released = false } = {}) {
  const agent = entry.agent;
  // In « À publier », a box to pick the entry for a grouped action; an invalid entry cannot be picked.
  const pick = released || current ? '' : publishable(entry)
    ? `<label class="pick" title="Choisir pour une action groupée"><input type="checkbox" data-pick="${escapeHtml(entry.slug)}"${selected.has(entry.slug) ? ' checked' : ''}></label>`
    : '<span class="pick off" title="Entrée invalide : non publiable">✕</span>';
  const links = [
    entry.report ? `<a class="btn" href="${escapeHtml(entry.report)}" target="_blank">📄 Rapport</a>` : '',
    agent && !released ? `<a class="btn" href="/journal?agent=${encodeURIComponent(agent.name)}" target="_blank">Commits</a>` : '',
    agent?.archived && !released && !current ? `<button class="btn" data-vaction="unarchive" data-agent="${escapeHtml(agent.name)}" title="Remettre dans les tâches en cours">↩ Désarchiver</button>` : '',
  ].join('');
  if (entry.missing) {
    const why = entry.onBranch
      ? `Son entrée existe sur la branche ${escapeHtml(agent?.branch ?? '')}, mais pas encore ici : fusionne la branche pour pouvoir la publier.`
      : `Pas d'entrée <code>__CHANGES__/unreleased/${escapeHtml(entry.slug)}/</code> : l'agent n'en a pas écrit (<code>make changes-new NAME=${escapeHtml(entry.slug)}</code>).`;
    return `<section class="card entry missing"><div class="top">${pick}<span class="badge">sans entrée</span><span class="name">${escapeHtml(entry.slug)}</span></div>
      <div class="note bad">${why}</div>${current ? `<div class="actions">${assignSelect(entry, current)}</div>` : ''}<div class="actions">${links}</div></section>`;
  }
  const invalid = entry.errors.length > 0;
  return `<section class="card entry t-${escapeHtml(entry.type ?? 'x')}${invalid ? ' invalid' : ''}${selected.has(entry.slug) ? ' picked' : ''}">
    <div class="top">${pick}<span class="badge">${escapeHtml(entry.badge ?? 'type ?')}</span><span class="spacer"></span><span class="pill" title="dossier de l'entrée">${escapeHtml(entry.slug)}</span></div>
    <div class="title">${escapeHtml(entry.title ?? entry.slug)}</div>
    ${entry.image ? `<img class="hero" src="${escapeHtml(entry.image)}" alt="" loading="lazy">` : '<div class="noimg">pas d’image à la une</div>'}
    <div class="pitch">${escapeHtml(entry.pitch ?? '')}</div>
    ${entry.audience && entry.audience !== 'players' ? `<div class="note">pour les ${entry.audience === 'admins' ? 'admins' : 'développeurs'} : changelog et page publique, pas le panneau du jeu</div>` : ''}
    ${invalid ? `<ul class="errors">${entry.errors.map((error) => `<li>${escapeHtml(error)}</li>`).join('')}</ul>` : released ? '' : '<span class="note fresh">entrée valide ✓</span>'}
    <div class="actions">${released ? '' : assignSelect(entry, current)}${links}</div>
  </section>`;
}

// The grouped actions of « À publier »: a target generation (a new one, numbered by the engine, or one in
// preparation), then assign or publish the selection, or publish everything publishable.
function bulkBar() {
  const valid = versions.pending.filter(publishable);
  for (const slug of [...selected]) if (!valid.some((entry) => entry.slug === slug)) selected.delete(slug);
  const invalid = versions.pending.length - valid.length;
  const all = valid.length > 0 && valid.every((entry) => selected.has(entry.slug));
  const target = document.getElementById('bulk-target')?.value ?? '';
  const options = [`<option value=""${target === '' ? ' selected' : ''}>une nouvelle __RELEASE__ (numéro proposé)</option>`,
    ...versions.planned.map((planned) => `<option value="${escapeHtml(planned.version)}"${target === planned.version ? ' selected' : ''}>la ${escapeHtml(planned.generation)} en préparation</option>`)];
  return `<div class="bulk">
    <label><input type="checkbox" data-pick-all${all ? ' checked' : ''}${valid.length ? '' : ' disabled'}> Tout sélectionner</label>
    <span class="note"><b>${selected.size}</b> / ${valid.length} choisie(s)${invalid ? ` · ${invalid} invalide(s), non publiable(s)` : ''}</span>
    <span class="spacer"></span>
    <span class="note">dans</span><select class="assign" id="bulk-target">${options.join('')}</select>
    <button class="btn" data-vaction="bulk-assign"${selected.size ? '' : ' disabled'} title="Range les entrées choisies dans cette __RELEASE__, sans publier">Affecter la sélection</button>
    <button class="btn" data-vaction="bulk-publish"${selected.size ? '' : ' disabled'} title="Range la sélection dans la __RELEASE__, montre l'aperçu et la validation, puis publie après confirmation">🚀 Publier la sélection</button>
    <button class="btn publish small" data-vaction="bulk-all"${valid.length ? '' : ' disabled'} title="Toutes les entrées valides dans la __RELEASE__, aperçu, confirmation, publication">🚀 Tout publier</button>
  </div>`;
}

// Assigns the chosen entries to the target generation; with `publish`, opens its tab (preview and validation) and asks
// to publish it as its own button does.
async function bulkAction(slugs, publishAfter) {
  if (!slugs.length) return;
  const version = document.getElementById('bulk-target')?.value ?? '';
  const result = await versionsAction('assign-many', { slugs, version });
  if (!result.ok) return;
  selected.clear();
  if (!publishAfter) return renderVersions(true);
  showTab(`v:${result.version}`);
  // Let the preview show before the confirmation.
  await new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 80)));
  const planned = versions.planned.find((candidate) => candidate.version === result.version);
  if (!planned) return;
  if (planned.problems.length) return setBanner('bad', `La ${planned.generation} ne peut pas encore être publiée :\n• ${planned.problems.join('\n• ')}`);
  await confirmAndPublish(result.version, document.querySelector('[data-vaction="publish"]'));
}

function pendingView() {
  const intro = `<div class="vhead"><h2>À publier</h2><span class="note">Tâches archivées dont l'entrée n'est dans aucune __RELEASE__. Affecte-les à une __RELEASE__ en préparation, ou à une nouvelle (${escapeHtml(versions.proposal)} proposée).</span></div>`;
  const errors = versions.errors.length ? `<ul class="problems">${versions.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>` : '';
  if (!versions.pending.length) return `${intro}${errors}<div class="empty">Rien à publier : toutes les entrées ont leur __RELEASE__.</div>`;
  return `${intro}${errors}${bulkBar()}<div class="entries">${versions.pending.map((entry) => entryCard(entry)).join('')}</div>`;
}

function whatsNewPreview(release) {
  if (!release) return '<div class="empty">Aucune entrée valide à montrer.</div>';
  const players = release.entries.filter((entry) => entry.audience === 'players');
  const others = release.entries.length - players.length;
  return `<div class="players">
    <div class="gen">${escapeHtml(release.generation)}${release.title ? ` · ${escapeHtml(release.title)}` : ''}</div>
    ${release.intro ? `<div class="intro">${escapeHtml(release.intro)}</div>` : ''}
    ${players.map((entry) => `<article>
      <div class="top"><span class="badge" style="--status:${entry.type === 'new' ? 'var(--say)' : entry.type === 'improved' ? 'var(--ok)' : 'var(--warn)'}">${escapeHtml(versions.badges?.[entry.type] ?? entry.type)}</span><b>${escapeHtml(entry.title)}</b></div>
      <div class="pitch" style="margin:4px 0">${escapeHtml(entry.pitch)}</div>
      ${entry.images[0] ? `<img src="${escapeHtml(entry.images[0])}" alt="">` : ''}
      <div class="md">${window.renderMarkdown ? window.renderMarkdown(entry.body) : escapeHtml(entry.body)}</div>
    </article>`).join('') || '<div class="empty">Aucune entrée pour __READER__ dans cette __RELEASE__.</div>'}
    ${others ? `<div class="note">+ ${others} entrée(s) admins / développeurs, visibles dans le changelog seulement.</div>` : ''}
  </div>`;
}

function versionView(planned) {
  const ready = !planned.problems.length;
  return `<div class="vhead"><h2>${escapeHtml(planned.generation)} — en préparation</h2><span class="pill">v${escapeHtml(planned.version)}</span><span class="note">${planned.entries.length} tâche(s)</span></div>
  <div class="vcols">
    <div class="panel">
      <h3>Tâches de cette __RELEASE__</h3>
      ${planned.entries.length ? `<div class="entries">${planned.entries.map((entry) => entryCard(entry, { current: planned.version })).join('')}</div>` : '<div class="empty">Aucune tâche : affecte-en depuis « À publier ».</div>'}
    </div>
    <div class="panel">
      <h3>__Release__</h3>
      <form class="form" data-version-form="${escapeHtml(planned.version)}">
        <label for="f-version">Numéro</label><input id="f-version" name="to" value="${escapeHtml(planned.version)}" pattern="\\d+\\.\\d+\\.\\d+" title="X.Y.Z, après la dernière __RELEASE__ publiée">
        <label for="f-title">Titre</label><input id="f-title" name="title" value="${escapeHtml(planned.title)}" placeholder="Un titre court (facultatif)">
        <label for="f-intro">Mot d'intro</label><textarea id="f-intro" name="intro" placeholder="Une ou deux phrases pour ouvrir la __RELEASE__ (facultatif)">${escapeHtml(planned.intro)}</textarea>
        <span></span><span class="actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn danger" type="button" data-vaction="unplan" data-version="${escapeHtml(planned.version)}" title="Les tâches retournent dans « À publier »">Supprimer la __RELEASE__</button></span>
      </form>
      <h3>Validation</h3>
      ${ready ? '<span class="note fresh">✓ Prête à publier</span>' : `<ul class="problems">${planned.problems.map((problem) => `<li>${escapeHtml(problem)}</li>`).join('')}</ul>`}
      <button class="btn publish" data-vaction="publish" data-version="${escapeHtml(planned.version)}" ${ready ? '' : 'disabled'} title="Commit des seuls chemins de la publication et tag annoté v${escapeHtml(planned.version)}, sans push">🚀 Publier la ${escapeHtml(planned.generation)}</button>
      ${/\.0$/.test(planned.version) ? `<label class="note"><input type="checkbox" data-release-branch="${escapeHtml(planned.version)}" checked> créer la branche de version release/${escapeHtml(planned.version.split('.').slice(0, 2).join('.'))} depuis le tag (ses correctifs s'y publieront)</label>` : ''}
      <h3>Aperçu « __RELEASE_TITLE__ »</h3>
      ${whatsNewPreview(planned.whatsNew)}
      <h3>Aperçu du CHANGELOG</h3>
      <pre class="changelog">${escapeHtml(planned.changelog || '—')}</pre>
    </div>
  </div>`;
}

function releasedView() {
  if (!versions.released.length) return '<div class="vhead"><h2>Publiées</h2></div><div class="empty">Aucune __RELEASE__ publiée pour l\'instant.</div>';
  return `<div class="vhead"><h2>Publiées</h2><span class="note">version actuelle ${escapeHtml(versions.current)}</span></div>${versions.released
    .map((release) => `<section class="release">
      <h2>${escapeHtml(release.generation)}${release.title ? ` · ${escapeHtml(release.title)}` : ''}</h2>
      <div class="meta"><span>v${escapeHtml(release.version)}</span><span>${escapeHtml(release.date ?? 'sans date')}</span>${release.tag ? `<span class="pill ok">tag ${escapeHtml(release.tag)}</span>` : '<span class="pill warn">pas de tag</span>'}<span>${release.entries.length} entrée(s)</span></div>
      ${release.intro ? `<p>${escapeHtml(release.intro)}</p>` : ''}
      <div class="entries">${release.entries.map((entry) => entryCard(entry, { released: true })).join('')}</div>
    </section>`)
    .join('')}`;
}

// Redraws the tab bar and the visible view; `force` after a tab change.
function renderVersions(force = false) {
  const tabs = versions.planned.map((planned) => `<button class="tab version" data-tab="v:${escapeHtml(planned.version)}" title="En préparation">${escapeHtml(planned.generation)}<span class="n">${planned.entries.length}${planned.problems.length ? ' ⚠' : ''}</span></button>`).join('');
  patch(document.getElementById('version-tabs'), tabs);
  document.getElementById('count-pending').textContent = String(versions.pending.length);
  document.getElementById('count-released').textContent = String(versions.released.length);
  if (currentTab.startsWith('v:') && !versions.planned.some((planned) => `v:${planned.version}` === currentTab)) return showTab('pending');
  for (const button of document.querySelectorAll('.tab')) button.classList.toggle('on', button.dataset.tab === currentTab);
  document.getElementById('view-banner').hidden = !banner || currentTab === 'active';
  const draw = (id, html) => {
    const view = document.getElementById(id);
    // Leave a view alone while one of its fields is being used.
    if (!force && view.contains(document.activeElement) && document.activeElement !== document.body && document.activeElement.tagName !== 'BUTTON' && document.activeElement.tagName !== 'A') return;
    patch(view, html);
  };
  if (currentTab === 'pending') draw('view-pending', pendingView());
  if (currentTab === 'released') draw('view-released', releasedView());
  if (currentTab.startsWith('v:')) {
    const planned = versions.planned.find((candidate) => `v:${candidate.version}` === currentTab);
    if (!dirtyForms.has(planned.version) || force) draw('view-version', versionView(planned));
  }
}

async function refreshVersions() {
  try {
    const data = await (await fetch('/api/versions', { cache: 'no-store' })).json();
    const key = JSON.stringify(data);
    if (key === versionsKey) return;
    versionsKey = key;
    versions = data;
    renderVersions();
  } catch {}
}

async function versionsAction(action, body) {
  try {
    const result = await (await fetch(`/api/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
    if (!result.ok) setBanner('bad', result.error);
    else if (result.message) setBanner('ok', result.message);
    else setBanner();
    versionsKey = '';
    await refreshVersions();
    return result;
  } catch (error) {
    setBanner('bad', `Échec : ${error.message}`);
    return { ok: false };
  }
}

document.addEventListener('change', async (event) => {
  const select = event.target.closest('select[data-assign]');
  if (!select || !select.value) return;
  const slug = select.dataset.assign;
  let version = select.value === '-' ? '' : select.value;
  if (version === '?') {
    version = (prompt(`Numéro de la __RELEASE__ pour « ${slug} » (X.Y.Z) :`, versions.proposal) || '').trim();
    if (!version) return (select.value = '');
  }
  select.disabled = true;
  await versionsAction('assign', { slug, version });
  renderVersions(true);
});

document.addEventListener('input', (event) => {
  const form = event.target.closest('form[data-version-form]');
  if (form) dirtyForms.add(form.dataset.versionForm);
});

document.addEventListener('submit', async (event) => {
  const form = event.target.closest('form[data-version-form]');
  if (!form) return;
  event.preventDefault();
  const version = form.dataset.versionForm;
  const data = Object.fromEntries(new FormData(form));
  const result = await versionsAction('plan', { version, to: data.to, title: data.title, intro: data.intro });
  if (result.ok) {
    dirtyForms.delete(version);
    setBanner('ok', `${version === result.version ? '__Release__ enregistrée' : `__Release__ renumérotée en ${result.version}`}.`);
    if (result.version !== version) showTab(`v:${result.version}`);
    else renderVersions(true);
  }
});

document.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-vaction]');
  if (!target) return;
  event.preventDefault();
  const { vaction, version, agent } = target.dataset;
  if (vaction === 'close-banner') return setBanner();
  if (vaction === 'unarchive') {
    await fetch(`/api/unarchive/${encodeURIComponent(agent)}`, { method: 'POST' });
    refresh();
    versionsKey = '';
    return refreshVersions();
  }
  if (vaction === 'unplan') {
    if (!confirm(`Supprimer la __RELEASE__ ${version} en préparation ? Ses tâches retournent dans « À publier ».`)) return;
    dirtyForms.delete(version);
    return versionsAction('unplan', { version });
  }
  if (vaction === 'publish') return confirmAndPublish(version, target);
  if (vaction === 'bulk-assign') return bulkAction([...selected], false);
  if (vaction === 'bulk-publish') return bulkAction([...selected], true);
  if (vaction === 'bulk-all') return bulkAction(versions.pending.filter(publishable).map((entry) => entry.slug), true);
});

document.addEventListener('change', (event) => {
  const box = event.target.closest('input[data-pick], input[data-pick-all]');
  if (!box) return;
  if (box.hasAttribute('data-pick-all')) {
    for (const entry of versions.pending.filter(publishable)) box.checked ? selected.add(entry.slug) : selected.delete(entry.slug);
  } else box.checked ? selected.add(box.dataset.pick) : selected.delete(box.dataset.pick);
  renderVersions(true);
});

// The publication of a generation in preparation, after a confirmation: its button, or a grouped publication.
async function confirmAndPublish(version, button) {
  const planned = versions.planned.find((candidate) => candidate.version === version);
  if (!planned) return;
  const list = planned.entries.map((entry) => `  • ${entry.title ?? entry.slug}`).join('\n');
  if (dirtyForms.has(version)) return setBanner('bad', 'Enregistre d’abord le numéro, le titre ou le mot d’intro modifiés.');
  const branchBox = document.querySelector(`input[data-release-branch="${version}"]`);
  const branch = branchBox ? branchBox.checked : false;
  const branchLine = branch ? `\n\nLa branche de version release/${version.split('.').slice(0, 2).join('.')} partira du tag : ses correctifs s'y publieront (onglet Branches).` : '';
  if (!confirm(`Publier la ${planned.generation} (v${version}) ?\n\n${list}\n\nSeules ces entrées sont publiées : elles passent dans __CHANGES__/v${version}/, les versions des package.json et CHANGELOG.md sont mis à jour, puis un commit de ces seuls chemins et le tag v${version} sont posés. Pas de push.${branchLine}`)) return;
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="spin"></span>Publication…';
  }
  const result = await versionsAction('publish', { version, branch });
  if (result.ok) showTab('released');
  else renderVersions(true);
}
