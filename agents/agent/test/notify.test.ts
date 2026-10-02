import '../../test/env.mjs';
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanSettings, decide, DEFAULT_SETTINGS, deviceId, encrypt, isQuiet, makeVapid, notifier, readDevices, render, subscribe, summary, updateDevice, vapidHeader } from '../notify.mjs';
import { diffFacts } from '../notify-events.mjs';

const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});
const registry = () => {
  const dir = mkdtempSync(join(tmpdir(), 'agents-notify-'));
  folders.push(dir);
  return dir;
};

// What a browser does with a push: its key pair and auth secret, then RFC 8291 backwards.
function browser() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return { ecdh, auth, subscription: { endpoint: 'https://push.example/abc', keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } };
}
const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest();
function decrypt(ua: ReturnType<typeof browser>, body: Buffer) {
  const salt = body.subarray(0, 16);
  const idlen = body[20];
  const asPublic = body.subarray(21, 21 + idlen);
  const shared = ua.ecdh.computeSecret(asPublic);
  const ikm = hmac(hmac(ua.auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua.ecdh.getPublicKey(), asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const data = body.subarray(21 + idlen);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(data.subarray(-16));
  const plain = Buffer.concat([decipher.update(data.subarray(0, -16)), decipher.final()]);
  expect(plain.at(-1)).toBe(2);
  return plain.subarray(0, -1).toString();
}

describe('web push', () => {
  it('encrypts a message that the browser decrypts (RFC 8291, aes128gcm)', () => {
    const ua = browser();
    const body = encrypt(ua.subscription, JSON.stringify({ title: 'Été', body: 'à toi' }));
    expect(body.readUInt32BE(16)).toBe(4096);
    expect(JSON.parse(decrypt(ua, body))).toEqual({ title: 'Été', body: 'à toi' });
  });

  it('signs a VAPID token for the push service (RFC 8292)', () => {
    const vapid = makeVapid();
    const header = vapidHeader(vapid, 'https://fcm.googleapis.com/fcm/send/xyz', 'https://moi.ts.net', 1_800_000_000_000);
    const [, jwt, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header)!;
    expect(key).toBe(vapid.publicKey);
    const [head, claims, signature] = jwt.split('.');
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toEqual({ aud: 'https://fcm.googleapis.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://moi.ts.net' });
    const point = Buffer.from(vapid.publicKey, 'base64url');
    const publicKey = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') }, format: 'jwk' });
    expect(verify('sha256', Buffer.from(`${head}.${claims}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url'))).toBe(true);
  });
});

describe('settings', () => {
  it('keeps what is valid and puts back the defaults for the rest', () => {
    const settings = cleanSettings({ events: { question: false, nope: true }, quiet: { enabled: true, from: '25:00', to: '07:30' }, group: 'digest', digestMinutes: 999, mutedAgents: ['ok-1', 'Bad Name'], detail: 'weird' });
    expect(settings.events.question).toBe(false);
    expect(settings.events).not.toHaveProperty('nope');
    expect(settings.quiet).toMatchObject({ enabled: true, from: DEFAULT_SETTINGS.quiet.from, to: '07:30' });
    expect(settings).toMatchObject({ group: 'digest', digestMinutes: 240, mutedAgents: ['ok-1'], detail: 'full' });
  });

  it('knows the quiet hours in the device time zone, past midnight too', () => {
    const settings = cleanSettings({ quiet: { enabled: true, from: '22:00', to: '08:00' } });
    // 23:30 in Paris (summer: UTC+2) is 21:30 UTC.
    expect(isQuiet(settings, 'Europe/Paris', new Date('2026-07-01T21:30:00Z'))).toBe(true);
    expect(isQuiet(settings, 'UTC', new Date('2026-07-01T21:30:00Z'))).toBe(false);
    expect(isQuiet(settings, 'Europe/Paris', new Date('2026-07-01T10:00:00Z'))).toBe(false);
  });

  it('sends, holds or drops an event as the device wants', () => {
    const at = { timeZone: 'UTC', now: new Date('2026-07-01T23:00:00Z') };
    const quiet = cleanSettings({ quiet: { enabled: true, from: '22:00', to: '08:00', mode: 'hold', urgent: true } });
    expect(decide(quiet, { type: 'agent-done' }, at)).toBe('hold');
    expect(decide(quiet, { type: 'question' }, at)).toBe('send');
    expect(decide(cleanSettings({ ...quiet, quiet: { ...quiet.quiet, mode: 'drop' } }), { type: 'agent-done' }, at)).toBe('drop');
    expect(decide(cleanSettings({ events: { version: false } }), { type: 'version' }, at)).toBe('drop');
    expect(decide(cleanSettings({ mutedAgents: ['bruit'] }), { type: 'agent-done', agent: 'bruit' }, at)).toBe('drop');
    expect(decide(cleanSettings({ group: 'digest' }), { type: 'agent-done' }, at)).toBe('hold');
    expect(decide(cleanSettings({ enabled: false }), { type: 'question' }, at)).toBe('drop');
  });

  it('shows the detail, or only what happened, and groups by agent', () => {
    const event = { type: 'agent-done', agent: 'danse', title: 'danse a fini', body: 'Le moteur de danse', url: '/agents' };
    expect(render(cleanSettings({}), event)).toMatchObject({ title: 'danse a fini', body: 'Le moteur de danse', url: '/agents', silent: false });
    expect(render(cleanSettings({ detail: 'short', sound: false }), event)).toMatchObject({ title: 'Jeu de test : Un agent a fini', body: '', silent: true });
    expect(render(cleanSettings({ group: 'agent' }), event)).toMatchObject({ tag: 'agent-danse', renotify: true });
    expect(render(cleanSettings({}), { ...event, type: 'question' }).requireInteraction).toBe(true);
    expect(summary(cleanSettings({}), [event, { ...event, title: 'b a fini' }])).toMatchObject({ title: 'Jeu de test : 2 nouvelles', body: '• danse a fini\n• b a fini' });
  });
});

describe('devices', () => {
  it('subscribes a device, keeps its settings when it renews, sends, holds, then sends the summary, and forgets a gone one', async () => {
    const dir = registry();
    const ua = browser();
    const device = subscribe(dir, { subscription: ua.subscription, name: 'Téléphone', timeZone: 'UTC', origin: 'https://moi.ts.net' });
    expect(device.id).toBe(deviceId(ua.subscription.endpoint));
    updateDevice(dir, device.id, { settings: { quiet: { enabled: true, from: '22:00', to: '08:00' } } });
    expect(subscribe(dir, { subscription: ua.subscription }).settings.quiet.enabled).toBe(true);
    const sent: string[] = [];
    let status = 201;
    const send = notifier(dir, { pushImpl: async (_vapid: unknown, subscription: { endpoint: string }, notification: { title: string }) => (sent.push(notification.title), { ok: status < 300, status, gone: status === 410 }), log: {} });
    await send.notify({ type: 'agent-done', agent: 'a', title: 'a a fini' }, new Date('2026-07-01T12:00:00Z'));
    await send.notify({ type: 'agent-done', agent: 'b', title: 'b a fini' }, new Date('2026-07-01T23:00:00Z'));
    await send.notify({ type: 'agent-done', agent: 'c', title: 'c a fini' }, new Date('2026-07-01T23:30:00Z'));
    expect(sent).toEqual(['a a fini']);
    expect(readDevices(dir)[0].held).toHaveLength(2);
    await send.tick(new Date('2026-07-02T02:00:00Z'));
    expect(sent).toHaveLength(1);
    await send.tick(new Date('2026-07-02T08:05:00Z'));
    expect(sent.at(-1)).toBe('Jeu de test : 2 nouvelles');
    expect(readDevices(dir)[0].held).toEqual([]);
    expect(await send.test(device.id)).toEqual({ ok: true });
    status = 410;
    expect((await send.test(device.id)).ok).toBe(false);
    expect(readDevices(dir)).toEqual([]);
  });
});

describe('events', () => {
  const empty = { runs: {}, queue: {}, questions: {}, refusals: {}, archived: [], train: null, versions: [], chats: {} };
  it('says nothing the first time, then what changed', () => {
    expect(diffFacts(null, empty)).toEqual([]);
    const before = { ...empty, runs: { danse: { state: 'running', code: null, startedAt: 't1' } }, chats: { nid: { pending: true, count: 1, title: 'Nid', mode: 'task', error: false } } };
    const after = {
      ...empty,
      runs: { danse: { state: 'done', code: 0, startedAt: 't1' }, son: { state: 'running', code: null, startedAt: 't2' }, casse: { state: 'error', code: 1, startedAt: 't0' } },
      queue: { danse: { status: 'launched', title: 'Le moteur de danse', launchedAt: 't1' } },
      questions: { q1: { type: 'choice', agent: 'son', title: 'Quel format ?' } },
      refusals: { danse: { count: 1, last: 'fichiers non commités' } },
      archived: ['vieux'],
      train: { startedAt: 't', finishedAt: 't9', items: [{ name: 'a', state: 'accepted', message: '' }, { name: 'b', state: 'failed', message: 'conflit' }] },
      versions: ['v0.8.0'],
      chats: { nid: { pending: false, count: 2, title: 'Nid', mode: 'task', error: false } },
    };
    const types = diffFacts(before, after).map((event) => `${event.type}:${event.agent ?? ''}`);
    expect(types).toEqual(['agent-done:danse', 'agent-launched:son', 'question:son', 'accept-refused:danse', 'accepted:vieux', 'merge-train:', 'version:', 'chat:']);
    expect(diffFacts(before, after)[0]).toMatchObject({ title: 'danse a fini', body: 'Le moteur de danse\nPrêt à tester et à accepter.' });
    // A run that was already over is not told again.
    expect(diffFacts(after, after)).toEqual([]);
    expect(diffFacts({ ...after, runs: { ...after.runs, casse: { state: 'running', code: null, startedAt: 't0' } } }, after).map((event) => event.type)).toEqual(['agent-error']);
  });
});
