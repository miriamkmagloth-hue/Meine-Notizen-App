// Lesbare Sicherung: jede Notiz als Google-Dokument in einem sichtbaren Ordner
// „Meine Notizen – Sicherung“ in deinem Google Drive, sortiert nach Ordnern.
// Die App sieht dafür nur Dateien, die sie selbst angelegt hat (Berechtigung drive.file).
import * as db from './db.js';
import * as model from './model.js';
import { api, API, UPLOAD, SCOPE_FILE, hasScope, getToken, backupWanted, isConnected, onAfterSync } from './sync.js';

const ROOT_NAME = 'Meine Notizen – Sicherung';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';

export const backupStatus = { running: false, last: Number(localStorage.getItem('backupLast') || 0), error: '', rootId: localStorage.getItem('backupRoot') || '' };
const listeners = new Set();
export const onBackupStatus = fn => { listeners.add(fn); fn(backupStatus); };
const emit = () => listeners.forEach(fn => fn(backupStatus));

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function findOne(query) {
  const url = `${API}/files?q=${encodeURIComponent(query + ' and trashed=false')}&fields=files(id,name,parents)&pageSize=10`;
  const data = await (await api(url)).json();
  return data.files[0] || null;
}

async function createFolder(name, parent, props) {
  const res = await api(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: parent ? [parent] : undefined, appProperties: props }),
  });
  return (await res.json()).id;
}

async function ensureRoot(meta) {
  if (meta.rootId) return meta.rootId;
  const found = await findOne(`mimeType='${FOLDER_MIME}' and appProperties has { key='mnRoot' and value='1' }`);
  meta.rootId = found ? found.id : await createFolder(ROOT_NAME, null, { mnRoot: '1' });
  return meta.rootId;
}

async function ensureFolder(meta, id, name) {
  meta.folders = meta.folders || {};
  const known = meta.folders[id];
  if (known && known.name === name) return known.id;
  if (known) {
    await api(`${API}/files/${known.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    meta.folders[id] = { id: known.id, name };
    return known.id;
  }
  const root = await ensureRoot(meta);
  const found = await findOne(`mimeType='${FOLDER_MIME}' and '${q(root)}' in parents and appProperties has { key='mnFolder' and value='${q(id)}' }`);
  const folderId = found ? found.id : await createFolder(name, root, { mnFolder: id });
  meta.folders[id] = { id: folderId, name };
  return folderId;
}

/** Notiz als HTML aufbereiten, das Google Docs gut übernimmt. */
export function noteToDocHtml(note) {
  const d = document.createElement('div');
  d.innerHTML = note.html || '';
  // Kontrollkästchen als ☐ / ☑ darstellen
  d.querySelectorAll('ul.checklist').forEach(ul => {
    const box = document.createElement('div');
    ul.querySelectorAll(':scope > li').forEach(li => {
      const p = document.createElement('p');
      const done = li.getAttribute('data-checked') === 'true';
      p.innerHTML = (done ? '☑ ' : '☐ ') + (done ? `<s>${li.innerHTML}</s>` : li.innerHTML);
      box.append(p);
    });
    ul.replaceWith(...box.childNodes);
  });
  // SVG-Sticker kann Google Docs nicht anzeigen
  d.querySelectorAll('img').forEach(img => {
    if ((img.getAttribute('src') || '').startsWith('data:image/svg')) img.remove();
    else {
      const sticker = img.classList.contains('sticker');
      img.removeAttribute('class');
      if (sticker) img.setAttribute('height', '60');
      else img.setAttribute('width', '420');
    }
  });
  const title = model.noteTitle(note);
  const date = new Date(note.updatedAt || Date.now()).toLocaleString('de-AT', { dateStyle: 'medium', timeStyle: 'short' });
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>
    <h1>${esc(title)}</h1>
    <p style="color:#8a8a8a;font-size:9pt">Zuletzt bearbeitet: ${esc(date)} · Sicherung aus „Meine Notizen“</p>
    ${d.innerHTML}
  </body></html>`;
}

async function uploadDoc(note, folderId, docId) {
  const boundary = 'mnb' + Math.random().toString(36).slice(2);
  const title = model.noteTitle(note);
  const meta = docId
    ? { name: title }
    : { name: title, mimeType: DOC_MIME, parents: [folderId], appProperties: { mnNote: note.id } };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${noteToDocHtml(note)}\r\n--${boundary}--`;
  const url = docId
    ? `${UPLOAD}/files/${docId}?uploadType=multipart&fields=id,parents`
    : `${UPLOAD}/files?uploadType=multipart&fields=id,parents`;
  const res = await api(url, { method: docId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
  return res.json();
}

async function moveTo(fileId, fromId, toId) {
  await api(`${API}/files/${fileId}?addParents=${encodeURIComponent(toId)}&removeParents=${encodeURIComponent(fromId)}&fields=id`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
}

let timer = null;
let again = false;

/** Sichert alle seit der letzten Sicherung geänderten Notizen. */
export async function runBackup({ force = false } = {}) {
  if (!backupWanted() || !isConnected() || !navigator.onLine) return;
  if (backupStatus.running) { again = true; return; }
  backupStatus.running = true;
  backupStatus.error = '';
  emit();
  try {
    await getToken(false);
    if (!hasScope(SCOPE_FILE)) throw new Error('Bitte die Sicherung einmal neu bestätigen (Einstellungen → Lesbare Sicherung).');
    const meta = (await db.get('kv', 'backupMeta')) || {};
    meta.notes = meta.notes || {};
    const books = Object.fromEntries(model.listOf('notebook').map(b => [b.id, b]));
    for (const note of model.listOf('note')) {
      const m = meta.notes[note.id];
      if (!force && m && m.u === note.updatedAt) continue;
      if (note.deleted) {
        if (m?.docId) {
          const trashFolder = await ensureFolder(meta, '__trash', 'Gelöscht');
          if (m.folderId !== trashFolder) await moveTo(m.docId, m.folderId, trashFolder);
          meta.notes[note.id] = { ...m, folderId: trashFolder, u: note.updatedAt };
        }
        continue;
      }
      const nb = books[note.notebookId] && !books[note.notebookId].deleted ? books[note.notebookId] : books[model.DEFAULT_NOTEBOOK];
      const folderId = await ensureFolder(meta, nb?.id || model.DEFAULT_NOTEBOOK, nb?.name || 'Allgemein');
      let docId = m?.docId;
      if (!docId) {
        const found = await findOne(`appProperties has { key='mnNote' and value='${q(note.id)}' }`);
        if (found) { docId = found.id; meta.notes[note.id] = { docId, folderId: found.parents?.[0] }; }
      }
      try {
        const res = await uploadDoc(note, folderId, docId);
        docId = res.id;
      } catch (e) {
        if (docId && /not found|404/i.test(e.message)) { const res = await uploadDoc(note, folderId, null); docId = res.id; }
        else throw e;
      }
      const prevFolder = meta.notes[note.id]?.folderId;
      if (prevFolder && prevFolder !== folderId) await moveTo(docId, prevFolder, folderId).catch(() => {});
      meta.notes[note.id] = { docId, folderId, u: note.updatedAt };
      await db.put('kv', meta, 'backupMeta');
    }
    await db.put('kv', meta, 'backupMeta');
    backupStatus.rootId = meta.rootId || '';
    localStorage.setItem('backupRoot', backupStatus.rootId);
    backupStatus.last = Date.now();
    localStorage.setItem('backupLast', String(backupStatus.last));
  } catch (e) {
    console.warn('Sicherung', e);
    backupStatus.error = e.message || String(e);
  } finally {
    backupStatus.running = false;
    emit();
    if (again) { again = false; schedule(5000); }
  }
}

function schedule(delay = 20000) {
  clearTimeout(timer);
  timer = setTimeout(() => runBackup(), delay);
}

export function startBackup() {
  // Nach jedem erfolgreichen Abgleich (gesammelt) die geänderten Notizen sichern
  onAfterSync(() => schedule(20000));
}

export function rootLink() {
  return backupStatus.rootId ? `https://drive.google.com/drive/folders/${backupStatus.rootId}` : 'https://drive.google.com/drive/my-drive';
}
