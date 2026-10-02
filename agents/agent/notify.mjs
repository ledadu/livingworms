// Notifications on the phone (or any browser): the standard Web Push of browsers, sent by the dashboard itself, with no
// dependency and no third party that could read them (the push service of the browser only carries an encrypted
// message). Each device subscribes from the « Notifications » page (/notifications, sw.js) and keeps its own settings:
// which events, quiet hours, detail, sound, grouping, muted agents.
//
// Files, in the registry (.git/agents/push/): vapid.json (the dashboard's key pair, made once), devices.json (each
// device: its subscription, name, time zone, settings, held notifications).
//
// Crypto: RFC 8291 (message encryption, aes128gcm) and RFC 8292 (VAPID), with node:crypto.
import { createCipheriv, createECDH, createHash, createHmac, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project } from '../config.mjs';

// ---------------------------------------------------------------------------------------------------------------
// The events, and the settings of a device

/** The events a device can be told about: label, what it says, urgent (may go through quiet hours), on by default. */
export const EVENTS = {
  question: { label: 'Une question d’un agent', hint: 'un agent attend ton choix ou ta validation', urgent: true, on: true },
  'agent-done': { label: 'Un agent a fini', hint: 'son chantier est prêt à tester et à accepter', urgent: false, on: true },
  'agent-error': { label: 'Un agent s’est arrêté en erreur', hint: 'ou son processus a disparu', urgent: true, on: true },
  'accept-refused': { label: '« Accepter » a refusé une branche', hint: 'fichiers non commités, conflit, dépôt principal…', urgent: false, on: true },
  accepted: { label: 'Une tâche acceptée', hint: 'fusionnée, elle passe dans « À publier »', urgent: false, on: false },
  'agent-launched': { label: 'Un agent a démarré', hint: 'lancé depuis le tableau de bord, ou d’elle-même (⚡ auto)', urgent: false, on: false },
  'merge-train': { label: 'La fusion en série a fini', hint: 'avec ce qui a été accepté et ce qui a échoué', urgent: false, on: true },
  feedback: { label: 'Un retour d’agent à lire', hint: 'un agent te laisse un mot', urgent: false, on: false },
  chat: { label: 'Claude a répondu dans le backlog', hint: 'la discussion 💬 ou 🧩 d’un chantier', urgent: false, on: true },
  version: { label: 'Une version publiée', hint: 'son tag est posé', urgent: false, on: true },
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  events: Object.fromEntries(Object.entries(EVENTS).map(([key, event]) => [key, event.on])),
  // Quiet hours, in the device's time zone: held until the end (« hold ») or dropped (« drop »); urgent ones may pass.
  quiet: { enabled: false, from: '22:00', to: '08:00', mode: 'hold', urgent: true },
  // full: titles and names; short: only what happened (« un agent a fini »), for a lock screen others may see.
  detail: 'full',
  sound: true,
  vibrate: true,
  // Urgent ones stay on screen until touched.
  sticky: true,
  // each: one notification per event; agent: the newest of an agent replaces its previous one; digest: one summary
  // every `digestMinutes`.
  group: 'each',
  digestMinutes: 15,
  mutedAgents: [],
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A device's settings made whole and valid: unknown keys dropped, bad values back to the default. */
export function cleanSettings(input = {}) {
  const out = structuredClone(DEFAULT_SETTINGS);
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled;
  for (const key of Object.keys(EVENTS)) if (typeof input.events?.[key] === 'boolean') out.events[key] = input.events[key];
  const quiet = input.quiet ?? {};
  if (typeof quiet.enabled === 'boolean') out.quiet.enabled = quiet.enabled;
  if (TIME.test(quiet.from ?? '')) out.quiet.from = quiet.from;
  if (TIME.test(quiet.to ?? '')) out.quiet.to = quiet.to;
  if (['hold', 'drop'].includes(quiet.mode)) out.quiet.mode = quiet.mode;
  if (typeof quiet.urgent === 'boolean') out.quiet.urgent = quiet.urgent;
  if (['full', 'short'].includes(input.detail)) out.detail = input.detail;
  for (const key of ['sound', 'vibrate', 'sticky']) if (typeof input[key] === 'boolean') out[key] = input[key];
  if (['each', 'agent', 'digest'].includes(input.group)) out.group = input.group;
  if (Number.isFinite(input.digestMinutes)) out.digestMinutes = Math.min(240, Math.max(1, Math.round(input.digestMinutes)));
  if (Array.isArray(input.mutedAgents)) out.mutedAgents = [...new Set(input.mutedAgents.filter((name) => /^[a-z0-9-]+$/.test(name)))];
  return out;
}

/** The minutes of the day it is in a time zone (the device's). */
export function minutesIn(timeZone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
    return Number(parts.find((part) => part.type === 'hour').value) * 60 + Number(parts.find((part) => part.type === 'minute').value);
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

/** Whether a device is in its quiet hours (a range may run past midnight). */
export function isQuiet(settings, timeZone, date = new Date()) {
  if (!settings.quiet.enabled) return false;
  const at = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3));
  const [from, to, now] = [at(settings.quiet.from), at(settings.quiet.to), minutesIn(timeZone, date)];
  return from <= to ? now >= from && now < to : now >= from || now < to;
}

/**
 * What a device does with an event: « send » it now, « hold » it (quiet hours, or a digest), or « drop » it.
 * `event`: { type, agent? }.
 */
export function decide(settings, event, { timeZone = 'UTC', now = new Date() } = {}) {
  if (!settings.enabled || !settings.events[event.type]) return 'drop';
  if (event.agent && settings.mutedAgents.includes(event.agent)) return 'drop';
  if (isQuiet(settings, timeZone, now) && !(settings.quiet.urgent && EVENTS[event.type]?.urgent)) return settings.quiet.mode === 'hold' ? 'hold' : 'drop';
  if (settings.group === 'digest' && !EVENTS[event.type]?.urgent) return 'hold';
  return 'send';
}

/** The notification a device shows for an event, as its settings want it (sw.js reads these fields). */
export function render(settings, event) {
  const short = settings.detail === 'short';
  const urgent = Boolean(EVENTS[event.type]?.urgent);
  return {
    title: short ? `${project.name} : ${EVENTS[event.type]?.label ?? event.type}` : event.title,
    body: short ? '' : event.body ?? '',
    url: event.url ?? '/',
    tag: settings.group === 'agent' && event.agent ? `agent-${event.agent}` : `${event.type}-${event.agent ?? ''}-${event.key ?? Date.now()}`,
    renotify: settings.group === 'agent',
    silent: !settings.sound,
    vibrate: settings.vibrate ? (urgent ? [120, 60, 120, 60, 200] : [100]) : [],
    requireInteraction: settings.sticky && urgent,
  };
}

/** One notification for events held (quiet hours ended, or a digest due). */
export function summary(settings, events) {
  if (events.length === 1) return render(settings, events[0]);
  const short = settings.detail === 'short';
  const lines = events.slice(-6).map((event) => `• ${short ? EVENTS[event.type]?.label ?? event.type : event.title}`);
  if (events.length > 6) lines.unshift(`… et ${events.length - 6} de plus`);
  return {
    title: `${project.name} : ${events.length} nouvelles`,
    body: lines.join('\n'),
    url: '/agents',
    tag: 'digest',
    renotify: true,
    silent: !settings.sound,
    vibrate: settings.vibrate ? [100] : [],
    requireInteraction: false,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Web Push: VAPID keys and signature (RFC 8292), message encryption (RFC 8291)

const b64url = (buffer) => Buffer.from(buffer).toString('base64url');
const fromB64url = (text) => Buffer.from(String(text), 'base64url');
const hmac = (key, data) => createHmac('sha256', key).update(data).digest();

/** A new VAPID key pair: { publicKey (base64url, uncompressed point), privateJwk }. */
export function makeVapid() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  return { publicKey: b64url(Buffer.concat([Buffer.from([4]), fromB64url(jwk.x), fromB64url(jwk.y)])), privateJwk: jwk };
}

/** The Authorization header of a push to `endpoint`: a JWT signed ES256 by the dashboard's key. */
export function vapidHeader(vapid, endpoint, subject, now = Date.now()) {
  const header = b64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64url(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const key = createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${header}.${claims}.${b64url(signature)}, k=${vapid.publicKey}`;
}

/**
 * The body of a push message for a subscription ({ keys: { p256dh, auth } }), encrypted as RFC 8291 says (aes128gcm,
 * one record). `salt` and `local` (an ECDH) may be given, for the tests.
 */
export function encrypt(subscription, payload, { salt = randomBytes(16), local = null } = {}) {
  const uaPublic = fromB64url(subscription.keys.p256dh);
  const authSecret = fromB64url(subscription.keys.auth);
  const ecdh = local ?? createECDH('prime256v1');
  if (!local) ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, shared);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header[20] = asPublic.length;
  return Buffer.concat([header, asPublic, body]);
}

/**
 * Sends one notification to a subscription. Returns { ok, status, gone } (gone: the subscription no longer exists,
 * 404 or 410: forget the device).
 */
export async function push(vapid, subscription, notification, { subject, urgency = 'normal', ttl = 24 * 3600, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(subscription.endpoint, {
    method: 'POST',
    headers: {
      TTL: String(ttl),
      Urgency: urgency,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      Authorization: vapidHeader(vapid, subscription.endpoint, subject),
    },
    body: encrypt(subscription, JSON.stringify(notification)),
  });
  return { ok: response.ok, status: response.status, gone: response.status === 404 || response.status === 410 };
}

// ---------------------------------------------------------------------------------------------------------------
// The devices, and sending to them

const pushDir = (registry) => join(registry, 'push');

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  mkdirSync(join(file, '..'), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temp, file);
}

/** The dashboard's VAPID keys, made the first time. */
export function vapidKeys(registry) {
  const file = join(pushDir(registry), 'vapid.json');
  const known = readJson(file, null);
  if (known?.publicKey && known?.privateJwk) return known;
  const made = makeVapid();
  writeJson(file, made);
  return made;
}

/** A device's id: the start of the hash of its subscription's endpoint (the page computes the same). */
export const deviceId = (endpoint) => createHash('sha256').update(String(endpoint)).digest('hex').slice(0, 16);

export const readDevices = (registry) => readJson(join(pushDir(registry), 'devices.json'), []);
const writeDevices = (registry, devices) => writeJson(join(pushDir(registry), 'devices.json'), devices);

/** Adds or renews a device ({ subscription, name, timeZone, origin }); its settings are kept when it was known. */
export function subscribe(registry, { subscription, name, timeZone, origin }, now = new Date().toISOString()) {
  if (!subscription?.endpoint || !/^https:\/\//.test(subscription.endpoint) || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error('abonnement invalide');
  const devices = readDevices(registry);
  const id = deviceId(subscription.endpoint);
  const known = devices.find((device) => device.id === id);
  const device = {
    id,
    name: String(name || known?.name || 'Appareil').slice(0, 60),
    timeZone: String(timeZone || known?.timeZone || 'UTC'),
    origin: String(origin || known?.origin || ''),
    subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
    settings: cleanSettings(known?.settings),
    held: known?.held ?? [],
    createdAt: known?.createdAt ?? now,
    updatedAt: now,
  };
  writeDevices(registry, [...devices.filter((one) => one.id !== id), device]);
  return device;
}

export function updateDevice(registry, id, { settings, name } = {}) {
  const devices = readDevices(registry);
  const device = devices.find((one) => one.id === id);
  if (!device) throw Object.assign(new Error(`appareil inconnu ${id}`), { code: 404 });
  if (settings) device.settings = cleanSettings(settings);
  if (name) device.name = String(name).slice(0, 60);
  writeDevices(registry, devices);
  return device;
}

export function removeDevice(registry, id) {
  writeDevices(registry, readDevices(registry).filter((one) => one.id !== id));
}

/** A device as the page sees it: never its keys. */
export const publicDevice = (device) => ({ id: device.id, name: device.name, timeZone: device.timeZone, settings: device.settings, held: device.held.length, createdAt: device.createdAt, lastSentAt: device.lastSentAt ?? null, lastError: device.lastError ?? null });

/**
 * The sender of a dashboard: notify(event) decides for each device (send, hold, drop), tick() sends what was held
 * once its time has come (end of quiet hours, a digest due), test(id) sends a test. `pushImpl` for the tests.
 */
export function notifier(registry, { pushImpl = push, log = console } = {}) {
  const deliver = async (device, notification, urgent) => {
    const vapid = vapidKeys(registry);
    try {
      const result = await pushImpl(vapid, device.subscription, notification, { subject: device.origin || 'https://localhost', urgency: urgent ? 'high' : 'normal' });
      return result.gone ? 'gone' : result.ok ? 'ok' : `refusé (${result.status})`;
    } catch (error) {
      return `échec : ${error.message}`;
    }
  };
  // One pass over the devices at a time: the file is read, changed and written whole.
  let chain = Promise.resolve();
  const serial = (work) => (chain = chain.then(work, work));

  const apply = (change) => serial(async () => {
    const devices = readDevices(registry);
    const keep = [];
    for (const device of devices) {
      const outcome = await change(device);
      if (outcome === 'gone') {
        log.log?.(`notify: ${device.name} n’est plus abonné, retiré`);
        continue;
      }
      if (outcome && outcome !== 'ok' && outcome !== 'none') device.lastError = outcome;
      if (outcome === 'ok') (device.lastSentAt = new Date().toISOString(), delete device.lastError);
      keep.push(device);
    }
    writeDevices(registry, keep);
  });

  return {
    notify(event, now = new Date()) {
      return apply(async (device) => {
        const action = decide(device.settings, event, { timeZone: device.timeZone, now });
        if (action === 'drop') return 'none';
        if (action === 'hold') {
          device.held.push({ ...event, at: now.toISOString() });
          device.held = device.held.slice(-50);
          return 'none';
        }
        return deliver(device, render(device.settings, event), Boolean(EVENTS[event.type]?.urgent));
      });
    },
    tick(now = new Date()) {
      return apply(async (device) => {
        if (!device.held.length) return 'none';
        if (isQuiet(device.settings, device.timeZone, now) && device.settings.quiet.mode === 'hold') return 'none';
        if (device.settings.group === 'digest') {
          const since = Date.parse(device.digestAt ?? 0);
          if (now - since < device.settings.digestMinutes * 60_000) return 'none';
        }
        const events = device.held;
        device.held = [];
        device.digestAt = now.toISOString();
        return deliver(device, summary(device.settings, events), false);
      });
    },
    async test(id) {
      let outcome = 'appareil inconnu';
      await apply(async (device) => {
        if (device.id !== id) return 'none';
        return (outcome = await deliver(device, { title: `${project.name} : essai`, body: `Les notifications marchent sur « ${device.name} ».`, url: '/notifications', tag: 'test', renotify: true, silent: !device.settings.sound, vibrate: device.settings.vibrate ? [100] : [], requireInteraction: false }, false));
      });
      return outcome === 'ok' ? { ok: true } : { ok: false, error: outcome === 'gone' ? 'cet appareil n’est plus abonné : il a été retiré' : outcome };
    },
  };
}
