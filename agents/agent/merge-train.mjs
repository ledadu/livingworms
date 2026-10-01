// « ✓ Accepter la sélection » : the finished agents picked on the « En cours » tab, accepted one after the other. Each
// accept moves the base forward, so the next agent may no longer merge cleanly: when its accept meets a conflict, the
// agent is given the order to merge its base and settle the conflicts (🔀 Corriger les conflits), the train waits
// for it to finish, then accepts it again before moving on. Only one agent is handled at a time.
//
// The train lives in <registry>/merge-train.json, so that it survives a restart of the dashboard, which drives it
// (stepTrain on a timer). Item states: waiting, accepting, fixing (the agent is settling its conflicts), then
// accepted, failed or skipped (the train was stopped before its turn). When the main checkout itself stops the
// merge (another branch checked out, changes in its index), the train keeps the agent waiting and says why
// (`blocked`), then goes on by itself once that is fixed.
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const TRAIN_FILE = 'merge-train.json';
// Conflict fixes allowed per agent: past that, the train gives up on it and goes on with the next one.
export const MAX_FIXES = 2;
const FINAL = new Set(['accepted', 'failed', 'skipped']);
const NAME = /^[a-z0-9-]{1,120}$/;

export const isFinal = (item) => FINAL.has(item.state);

export function readTrain(registry) {
  try {
    return JSON.parse(readFileSync(join(registry, TRAIN_FILE), 'utf8'));
  } catch {
    return null;
  }
}

function writeTrain(registry, train) {
  const file = join(registry, TRAIN_FILE);
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(train, null, 2)}\n`);
  renameSync(temp, file);
  return train;
}

/**
 * Starts a train with these agents, in this order. A train still under way keeps its items: the new names not
 * already waiting in it are added at its end.
 */
export function startTrain(registry, names, now = new Date().toISOString()) {
  const list = [...new Set(names)];
  if (!list.length) throw new Error('aucun agent sélectionné');
  for (const name of list) if (!NAME.test(name)) throw new Error(`nom invalide ${name}`);
  const current = readTrain(registry);
  const running = current && !current.finishedAt ? current : null;
  const items = running ? running.items : [];
  const pending = new Set(items.filter((item) => !isFinal(item)).map((item) => item.name));
  for (const name of list) if (!pending.has(name)) items.push({ name, state: 'waiting', fixes: 0, message: '' });
  return writeTrain(registry, { startedAt: running?.startedAt ?? now, updatedAt: now, finishedAt: null, items });
}

/** Stops the train: the agents not reached yet are skipped. An agent settling its conflicts goes on on its own. */
export function stopTrain(registry, now = new Date().toISOString()) {
  const train = readTrain(registry);
  if (!train || train.finishedAt) return train;
  for (const item of train.items) {
    if (isFinal(item)) continue;
    item.state = 'skipped';
    item.message ||= 'file arrêtée avant son tour';
    if (item.fixes) item.message = 'file arrêtée : l’agent finit de régler ses conflits, accepte-le ensuite à la main';
  }
  return writeTrain(registry, { ...train, updatedAt: now, finishedAt: now, stopped: true });
}

/** Forgets a finished train (its panel goes). */
export function clearTrain(registry) {
  const train = readTrain(registry);
  if (train && !train.finishedAt) throw new Error('la file est en cours : arrête-la d’abord');
  rmSync(join(registry, TRAIN_FILE), { force: true });
  return { ok: true };
}

/**
 * One step of the train, on its current agent (the first not final):
 * - waiting: accept it; a conflict sends it the order to fix them (fixing), any other refusal fails it;
 * - fixing: nothing while the agent runs; once it is done, accept it again; stopped, lost or in error, it fails.
 * `accept(name)` answers like the dashboard's accept ({ ok, conflict, message, error }), `fix(name)` like its
 * « Corriger les conflits », `runState(name)` gives the agent's run (launch.mjs). Returns the train.
 */
export async function stepTrain(registry, { accept, fix, runState, now = () => new Date().toISOString() }) {
  const train = readTrain(registry);
  if (!train || train.finishedAt) return train;
  const item = train.items.find((one) => !isFinal(one));
  const save = () => writeTrain(registry, { ...train, updatedAt: now() });
  if (!item) return writeTrain(registry, { ...train, updatedAt: now(), finishedAt: now() });

  if (item.state === 'fixing') {
    const state = runState(item.name)?.state;
    if (state === 'running') return train;
    if (state !== 'done') {
      Object.assign(item, { state: 'failed', message: `l’agent s’est arrêté (${state ?? 'aucun processus'}) avant d’avoir réglé ses conflits` });
      return save();
    }
  }

  item.state = 'accepting';
  item.message = item.fixes ? 'conflits réglés, nouvelle fusion…' : 'fusion…';
  save();
  let result;
  try {
    result = await accept(item.name);
  } catch (error) {
    result = { ok: false, error: error.message };
  }
  train.blocked = null;
  if (result?.blocked) {
    Object.assign(item, { state: 'waiting', message: 'en attente du dépôt principal' });
    train.blocked = result.error ?? 'le dépôt principal refuse la fusion';
  } else if (result?.ok) {
    Object.assign(item, { state: 'accepted', message: result.message ?? 'acceptée' });
  } else if ((result?.conflict || result?.fixable) && item.fixes < MAX_FIXES) {
    let order;
    try {
      order = await fix(item.name, result);
    } catch (error) {
      order = { ok: false, error: error.message };
    }
    Object.assign(item, order?.ok
      ? { state: 'fixing', fixes: item.fixes + 1, message: `${result.conflict ? 'conflit : l’agent fusionne sa base et le règle' : `refusée (${result.error}) : l’agent corrige`} (correction ${item.fixes + 1}/${MAX_FIXES})` }
      : { state: 'failed', message: `${result.conflict ? 'conflit' : 'refusée'}, et l’ordre de correction a échoué : ${order?.error ?? 'refusé'}` });
  } else {
    Object.assign(item, { state: 'failed', message: result?.conflict ? `encore en conflit après ${MAX_FIXES} corrections` : item.fixes >= MAX_FIXES ? `encore refusée après ${MAX_FIXES} corrections : ${result?.error ?? 'refusée'}` : result?.error ?? 'refusée' });
  }
  // The train may have been stopped during the accept: its result goes into the train as it is now.
  const fresh = readTrain(registry);
  if (fresh?.stopped) {
    const index = fresh.items.findIndex((one) => one.name === item.name);
    if (index >= 0) fresh.items[index] = item;
    return writeTrain(registry, { ...fresh, updatedAt: now() });
  }
  if (train.items.every(isFinal)) train.finishedAt = now();
  return save();
}
