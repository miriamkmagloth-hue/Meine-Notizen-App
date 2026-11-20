// Synchronisierung über Google Drive (versteckter App-Ordner "appDataFolder").
// Jede Notiz, jedes Notizbuch und jeder eigene Sticker ist eine eigene JSON-Datei.
import * as db from './db.js';
import * as model from './model.js';
import { isAndroid, callAsync } from './native.js';

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BYTES = 4.8 * 1024 * 1024;

let token = null;
let tokenExpires = 0;
let syncing = false;
let again = false;
let timer = null;

export const status = { state: 'off', message: '', lastSync: Number(localStorage.getItem('lastSync') || 0) };
const statusListeners = new Set();
export function onStatus(fn) { statusListeners.add(fn); fn(status); }
function setStatus(state, message = '') {
  status.state = state;
  status.message = message;
  statusListeners.forEach(fn => fn(status));
}

export const isConnected = () => localStorage.getItem('driveConnected') === '1';
export const getClientId = () => localStorage.getItem('clientId') || '';
export const setClientId = id => localStorage.setItem('clientId', id.trim());

// ---------- Anmeldung ----------

let gisLoaded = null;
function loadGis() {
  if (!gisLoaded) {
    gisLoaded = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = resolve;
      s.onerror = () => { gisLoaded = null; reject(new Error('Google-Anmeldung konnte nicht geladen werden (offline?)')); };
      document.head.appendChild(s);
    });
  }
  return gisLoaded;
}

async function getToken(interactive) {
  if (token && Date.now() < tokenExpires - 60_000) return token;
  token = null;
  if (isAndroid) {
    const r = await callAsync('requestToken', !!interactive);
    if (r.token) {
      token = r.token;
      tokenExpires = Date.now() + 50 * 60_000;
      return token;
    }
    if (r.needsUi) return null;
    throw new Error(r.error || 'Anmeldung fehlgeschlagen');
  }
  const clientId = getClientId();
  if (!clientId) throw new Error('NO_CLIENT_ID');
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: resp => {
        if (resp.error) { reject(new Error(resp.error_description || resp.error)); return; }
        token = resp.access_token;
        tokenExpires = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
        resolve(token);
      },
      error_callback: err => {
        if (!interactive) resolve(null);
        else reject(new Error(err.type === 'popup_closed' ? 'Anmeldung abgebrochen' : 'Anmeldefenster blockiert – bitte Pop-ups erlauben'));
      },
    });
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

export async function connect() {
  const t = await getToken(true);
  if (!t) throw new Error('Anmeldung abgebrochen');
  localStorage.setItem('driveConnected', '1');
  await sync();
}

export function disconnect() {
  if (!isAndroid && token && window.google?.accounts?.oauth2) {
    try { window.google.accounts.oauth2.revoke(token); } catch { /* egal */ }
  }
  token = null;
  localStorage.removeItem('driveConnected');
  setStatus('off');
}

// ---------- Drive-API ----------

async function api(url, opts = {}, retry = true) {
  const t = await getToken(false);
  if (!t) { const e = new Error('NEEDS_AUTH'); e.needsAuth = true; throw e; }
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
  if (res.status === 401 && retry) { token = null; return api(url, opts, false); }
  if (!res.ok) {
    let msg = res.status + '';
    try { msg = (await res.json()).error.message; } catch { /* egal */ }
    throw new Error('Google Drive: ' + msg);
  }
  return res;
}

async function listFiles() {
  const files = [];
  let pageToken = '';
  do {
    const url = `${API}/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name,version)` +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const data = await (await api(url)).json();
    files.push(...data.files);
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return files;
}

async function download(fileId) {
  return (await api(`${API}/files/${fileId}?alt=media`)).json();
}

async function upload(name, obj, fileId) {
  const boundary = 'mn' + Math.random().toString(36).slice(2);
  const meta = fileId ? {} : { name, parents: ['appDataFolder'] };
  const content = JSON.stringify(obj);
  if (content.length > MAX_BYTES) throw new Error(`Notiz „${model.noteTitle(obj)}“ ist zu groß (zu viele Bilder) – bitte in zwei Notizen aufteilen.`);
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  const url = fileId
    ? `${UPLOAD}/files/${fileId}?uploadType=multipart&fields=id,version`
    : `${UPLOAD}/files?uploadType=multipart&fields=id,version`;
  const res = await api(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
    body,
  });
  return res.json();
}

// ---------- Abgleich ----------

const clean = item => { const { dirty, ...rest } = item; return rest; };
const fileName = (type, id) => `${type}-${id}.json`;

function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}

function sameContent(a, b) {
  const strip = x => { const { dirty, updatedAt, text, hasImage, ...r } = x; return stable(r); };
  return strip(a) === strip(b);
}

async function applyRemote(type, data) {
  data.dirty = false;
  if (type === 'note') await model.saveNote(data, { fromSync: true });
  else await model.save(type, data, { fromSync: true });
}

export async function sync({ interactive = false } = {}) {
  if (!isConnected()) { setStatus('off'); return; }
  if (!navigator.onLine) { setStatus('offline'); return; }
  if (syncing) { again = true; return; }
  syncing = true;
  setStatus('syncing');
  try {
    if (interactive) await getToken(true);
    const meta = (await db.get('kv', 'syncMeta')) || {};
    const remote = await listFiles();
    const remoteNames = new Map(remote.map(f => [f.name, f]));

    // 1) Änderungen von anderen Geräten holen
    for (const f of remote) {
      const m = /^(note|notebook|sticker|pref)-(.+)\.json$/.exec(f.name);
      if (!m) continue;
      const [, type, id] = m;
      const key = `${type}:${id}`;
      const known = meta[key];
      if (known && known.fileId === f.id && known.version === f.version) continue; // nichts Neues
      const data = await download(f.id);
      const local = model.find(type, id);
      // Google Drive erhöht die Versionsnummer manchmal, ohne dass sich der Inhalt geändert hat.
      // Entscheidend ist daher, ob es wirklich eine neue Fassung von einem anderen Gerät ist.
      const reallyNew = !known || known.u === undefined ? !local || (data.updatedAt || 0) > (local.updatedAt || 0) || !local.dirty
        : (data.updatedAt || 0) !== known.u;
      if (local && local.dirty && !reallyNew) {
        meta[key] = { fileId: f.id, version: f.version, u: known?.u ?? data.updatedAt };
        continue; // nichts Neues von außen – die lokale Änderung wird gleich hochgeladen
      }
      if (!local || !local.dirty) {
        await applyRemote(type, data);
      } else if (sameContent(local, data)) {
        local.dirty = false;
        await model.save(type, local, { fromSync: true });
      } else if (type === 'note' && !local.deleted && !data.deleted && known) {
        // Echte gleichzeitige Bearbeitung auf zwei Geräten: nichts geht verloren.
        // Die neuere Fassung bleibt die Notiz, die ältere wird als Kopie gesichert.
        const localNewer = (local.updatedAt || 0) >= (data.updatedAt || 0);
        const older = localNewer ? data : { ...local };
        const newer = localNewer ? local : data;
        const olderText = model.htmlToText(older.html || '').trim();
        const newerText = model.htmlToText(newer.html || '').trim();
        // Nur sichern, wenn in der älteren Fassung wirklich etwas steht, das in der neueren fehlt
        const worthKeeping = (olderText && !newerText.includes(olderText)) || /<img/.test(older.html || '') && !/<img/.test(newer.html || '');
        if (worthKeeping) {
          const copy = { ...clean(older), id: model.uid(), title: model.noteTitle(older) + ' (Konflikt-Kopie)' };
          await model.saveNote(copy);
        }
        if (!localNewer) await applyRemote(type, data);
      } else if (local.deleted && !data.deleted) {
        await applyRemote(type, data); // woanders weiterbearbeitet → wiederherstellen
      } else if (!local.deleted && data.deleted) {
        // lokal bearbeitet, woanders gelöscht → lokale Fassung behalten (wird hochgeladen)
      } else if ((data.updatedAt || 0) > (local.updatedAt || 0)) {
        await applyRemote(type, data);
      }
      meta[key] = { fileId: f.id, version: f.version, u: data.updatedAt };
    }

    // 2) Eigene Änderungen hochladen
    for (const type of ['notebook', 'sticker', 'pref', 'note']) {
      for (const item of [...model.listOf(type)]) {
        if (!item.dirty) continue;
        const key = `${type}:${item.id}`;
        const name = fileName(type, item.id);
        const fileId = meta[key]?.fileId || remoteNames.get(name)?.id;
        const stamp = item.updatedAt;
        const res = await upload(name, clean(item), fileId);
        meta[key] = { fileId: res.id, version: res.version, u: stamp };
        const current = model.find(type, item.id);
        if (current && current.updatedAt === stamp) {
          current.dirty = false;
          await db.put(model.STORE[type], current);
        }
      }
    }

    await db.put('kv', meta, 'syncMeta');
    status.lastSync = Date.now();
    localStorage.setItem('lastSync', String(status.lastSync));
    setStatus('ok');
  } catch (e) {
    console.warn('Sync', e);
    if (e.needsAuth) setStatus('needs-auth', 'Bitte erneut mit Google verbinden');
    else if (e.message === 'NO_CLIENT_ID') setStatus('error', 'Client-ID fehlt (Einstellungen)');
    else setStatus(navigator.onLine ? 'error' : 'offline', e.message);
  } finally {
    syncing = false;
    if (again) { again = false; schedule(500); }
  }
}

/** Plant einen Abgleich kurz nach der letzten Änderung. */
export function schedule(delay = 2500) {
  clearTimeout(timer);
  timer = setTimeout(() => sync(), delay);
}

export function hasPendingChanges() {
  return ['note', 'notebook', 'sticker', 'pref'].some(t => model.listOf(t).some(x => x.dirty));
}

export function startAutoSync() {
  model.onChange((type, item, fromSync) => { if (!fromSync) schedule(); });
  window.addEventListener('online', () => schedule(300));
  window.addEventListener('offline', () => setStatus('offline'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') schedule(300);
    else if (hasPendingChanges()) sync();
  });
  setInterval(() => { if (document.visibilityState === 'visible') sync(); }, 60_000);
  if (isConnected()) schedule(200); else setStatus('off');
}

/** Lädt die Google-Anmeldung vorab, damit das Anmeldefenster nicht vom Browser blockiert wird. */
export function preload() {
  if (!isAndroid && getClientId()) loadGis().catch(() => {});
}
