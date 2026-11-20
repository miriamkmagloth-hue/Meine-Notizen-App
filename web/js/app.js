// Hauptprogramm: Notizbücher, Notizliste, Editor, Einstellungen.
import * as model from './model.js';
import * as sync from './sync.js';
import { Editor } from './editor.js';
import { icon, el, esc, dialog, confirmBox, promptBox, choose, toast, relTime, closeTopDialog } from './ui.js';
import { isAndroid, isQuick, call } from './native.js';
import { pushNote, pushIndex, pushAll, applyPendingToggles } from './widget.js';

const APP_VERSION = '1.0';
const $ = s => document.querySelector(s);
const app = $('#app');
const COLORS = ['#e0864a', '#e5484d', '#d6409f', '#8e4ec6', '#3e63dd', '#0091ff', '#12a594', '#30a46c', '#ad7f58', '#6f6e77'];

const view = { notebook: 'all', search: '' };
let current = null;      // geöffnete Notiz
let isDraft = false;     // neue Notiz, noch nicht gespeichert
let saveTimer = null;
let pendingReload = null;
let editor;

const isNarrow = () => matchMedia('(max-width: 759px)').matches;
const isDrawer = () => matchMedia('(max-width: 1099px)').matches;

// ---------------- Start ----------------
async function init() {
  document.querySelectorAll('[data-icon]').forEach(n => { n.insertAdjacentHTML('afterbegin', icon(n.dataset.icon)); });
  if (isAndroid) document.body.classList.add('android');
  if (isQuick) document.body.classList.add('quick');

  await model.load();
  editor = new Editor($('#editor'), { onChange: html => { if (current) { current.html = html; scheduleSave(); } } });
  bindUI();

  if (isAndroid) {
    await applyPendingToggles();
    pushAll();
  }

  model.onChange((type, item, fromSync) => {
    if (type === 'note') {
      pushNote(item);
      pushIndex();
      if (fromSync && current && item.id === current.id) remoteUpdateOfCurrent(item);
    }
    if (type === 'notebook') pushIndex();
    renderSoon();
  });

  sync.onStatus(renderSync);
  sync.startAutoSync();
  sync.preload();

  const hash = new URLSearchParams(location.hash.slice(1));
  const start = hash.get('quick') || hash.get('note');
  render();
  if (start && model.find('note', start) && !model.find('note', start).deleted) openNote(start);
  else if (isQuick) { newNote(); }
  history.replaceState(null, '', location.pathname);

  if (!isAndroid && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// Von Android aufgerufen
window.handleBack = () => {
  if (closeTopDialog()) return true;
  if (editor.selectedImg) { editor.deselectImage(); return true; }
  if (isQuick) { finishQuick(); return true; }
  if (app.classList.contains('drawer-open')) { app.classList.remove('drawer-open'); return true; }
  if (isNarrow() && app.dataset.view === 'editor') { closeEditor(); return true; }
  return false;
};
window.onNativePause = async () => {
  await saveCurrent();
  if (sync.isConnected() && sync.hasPendingChanges()) sync.sync();
};
window.loadQuick = async id => {
  await saveCurrent();
  location.replace('#quick=' + encodeURIComponent(id));
  location.reload();
};
window.openNoteFromNative = id => { if (model.find('note', id)) openNote(id); };
window.onNativeResume = async () => {
  const changed = await applyPendingToggles();
  if (current && changed.includes(current.id)) remoteUpdateOfCurrent(model.find('note', current.id), true);
  sync.schedule(300);
};

// ---------------- Speichern ----------------
function scheduleSave() {
  $('#saved-state').textContent = 'Bearbeitet …';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrent, 600);
}

async function saveCurrent() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (!current) return;
  current.title = $('#note-title').value;
  if (isDraft && model.isEmptyNote({ ...current, text: model.htmlToText(current.html) })) return;
  isDraft = false;
  await model.saveNote(current);
  $('#saved-state').textContent = 'Gespeichert';
  renderMeta();
}

/** Änderung derselben Notiz von einem anderen Gerät (oder vom Widget). */
function remoteUpdateOfCurrent(item, force = false) {
  if (saveTimer) return; // eigene ungespeicherte Änderungen gewinnen
  const editing = document.activeElement === editor.content || document.activeElement === $('#note-title');
  if (editing && !force) { pendingReload = item; return; }
  current = item;
  if (item.deleted) { closeEditor(true); toast('Diese Notiz wurde auf einem anderen Gerät gelöscht'); return; }
  editor.setHTML(item.html);
  $('#note-title').value = item.title || '';
  autoGrow();
  renderMeta();
}

// ---------------- Notizen öffnen / anlegen ----------------
async function openNote(id) {
  await leaveCurrent();
  const note = model.find('note', id);
  if (!note) return;
  current = note;
  isDraft = false;
  showEditor();
  editor.setHTML(note.html);
  $('#note-title').value = note.title || '';
  $('#saved-state').textContent = '';
  autoGrow();
  renderMeta();
  renderList();
  $('.scroll-host').scrollTop = 0;
}

async function newNote() {
  await leaveCurrent();
  const nb = model.find('notebook', view.notebook) && !model.find('notebook', view.notebook).deleted ? view.notebook : model.DEFAULT_NOTEBOOK;
  current = model.newNote(nb);
  isDraft = true;
  showEditor();
  editor.setHTML('');
  $('#note-title').value = '';
  $('#saved-state').textContent = '';
  autoGrow();
  renderMeta();
  renderList();
  setTimeout(() => editor.focus(), 50);
}

async function leaveCurrent() {
  if (!current) return;
  await saveCurrent();
  const note = current;
  current = null;
  pendingReload = null;
  editor.deselectImage();
  if (!isDraft && !note.deleted && model.isEmptyNote(note)) await model.remove('note', note.id);
}

async function closeEditor(skipSave = false) {
  if (!skipSave) await leaveCurrent(); else current = null;
  $('#editor-wrap').classList.add('hidden');
  $('#editor-empty').classList.remove('hidden');
  app.dataset.view = 'list';
  renderList();
}

function showEditor() {
  $('#editor-empty').classList.add('hidden');
  $('#editor-wrap').classList.remove('hidden');
  app.dataset.view = 'editor';
  app.classList.remove('drawer-open');
}

async function finishQuick() {
  await saveCurrent();
  if (sync.isConnected() && sync.hasPendingChanges()) {
    $('#done-btn').textContent = 'Speichert …';
    await Promise.race([sync.sync(), new Promise(r => setTimeout(r, 5000))]);
  }
  call('closeQuickEdit');
}

// ---------------- Darstellung ----------------
let renderQueued = false;
function renderSoon() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; render(); });
}

function render() {
  renderNav();
  renderList();
  renderMeta();
}

function sortedNotebooks() {
  return model.active('notebook').sort((a, b) =>
    (a.id === model.DEFAULT_NOTEBOOK ? -1 : b.id === model.DEFAULT_NOTEBOOK ? 1 : a.name.localeCompare(b.name, 'de')));
}

function renderNav() {
  const notes = model.active('note');
  const count = id => notes.filter(n => n.notebookId === id).length;
  const items = [
    { id: 'all', name: 'Alle Notizen', ic: 'notes', n: notes.length },
    { id: 'pinned', name: 'Angeheftet', ic: 'pin', n: notes.filter(n => n.pinned).length },
  ];
  const nav = $('#nav');
  nav.innerHTML = items.map(i => `<button class="nav-item ${view.notebook === i.id ? 'on' : ''}" data-nb="${i.id}">${icon(i.ic)}<span class="nav-name">${i.name}</span><span class="count">${i.n || ''}</span></button>`).join('') +
    '<div class="nav-label">Notizbücher</div>' +
    sortedNotebooks().map(b => `<div class="nav-item nb ${view.notebook === b.id ? 'on' : ''}" data-nb="${esc(b.id)}" role="button" tabindex="0">
        <span class="dot" style="background:${esc(b.color || COLORS[0])}"></span><span class="nav-name">${esc(b.name)}</span>
        <span class="count">${count(b.id) || ''}</span>
        <button class="icon-btn nb-more" data-more="${esc(b.id)}" title="Notizbuch bearbeiten">${icon('more')}</button></div>`).join('');
  const title = view.notebook === 'all' ? 'Alle Notizen' : view.notebook === 'pinned' ? 'Angeheftet' : (model.find('notebook', view.notebook)?.name || 'Notizen');
  $('#list-title').textContent = title;
}

function checkProgress(html) {
  const done = (html.match(/data-checked="true"/g) || []).length;
  const all = done + (html.match(/data-checked="false"/g) || []).length;
  return all ? `<span class="progress ${done === all ? 'full' : ''}">${icon('check')}${done}/${all}</span>` : '';
}

function renderList() {
  let notes = model.active('note');
  if (view.notebook === 'pinned') notes = notes.filter(n => n.pinned);
  else if (view.notebook !== 'all') notes = notes.filter(n => n.notebookId === view.notebook);
  const q = view.search.trim().toLowerCase();
  if (q) notes = notes.filter(n => (n.title || '').toLowerCase().includes(q) || (n.text || '').toLowerCase().includes(q));
  notes.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));
  const list = $('#note-list');
  if (!notes.length) {
    list.innerHTML = `<div class="list-empty">${q ? 'Nichts gefunden.' : 'Noch keine Notizen hier.<br>Tippe auf <b>+</b>, um loszulegen.'}</div>`;
    return;
  }
  const books = Object.fromEntries(model.active('notebook').map(b => [b.id, b]));
  list.innerHTML = notes.map(n => {
    const title = model.noteTitle(n);
    const lines = (n.text || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!n.title?.trim()) lines.shift();
    const snippet = lines.join(' · ').slice(0, 140);
    const nb = books[n.notebookId];
    return `<button class="note-item ${current && current.id === n.id ? 'on' : ''}" data-id="${esc(n.id)}">
      <div class="ni-top"><span class="ni-title">${esc(title)}</span>${n.pinned ? `<span class="ni-pin">${icon('pin')}</span>` : ''}</div>
      ${snippet ? `<div class="ni-snippet">${esc(snippet)}</div>` : ''}
      <div class="ni-meta"><span>${relTime(n.updatedAt)}</span>
        ${view.notebook === 'all' && nb ? `<span class="ni-nb"><span class="dot" style="background:${esc(nb.color)}"></span>${esc(nb.name)}</span>` : ''}
        ${n.hasImage ? icon('image', 'ni-ic') : ''}${checkProgress(n.html || '')}</div>
    </button>`;
  }).join('');
}

function renderMeta() {
  if (!current) return;
  const nb = model.find('notebook', current.notebookId) || model.find('notebook', model.DEFAULT_NOTEBOOK);
  $('#nb-chip').innerHTML = `<span class="dot" style="background:${esc(nb?.color || COLORS[0])}"></span>${esc(nb?.name || 'Allgemein')}`;
  $('#pin-btn').classList.toggle('on', !!current.pinned);
  $('#note-meta').textContent = current.updatedAt
    ? `Zuletzt bearbeitet ${relTime(current.updatedAt)}${current.createdAt ? ' · erstellt ' + new Date(current.createdAt).toLocaleDateString('de-AT') : ''}`
    : 'Neue Notiz';
}

function renderSync(st) {
  const map = {
    off: ['cloudOff', 'Google Drive verbinden'],
    syncing: ['cloudSync', 'Synchronisiere …'],
    ok: ['cloudOk', 'Synchronisiert' + (st.lastSync ? ' · ' + relTime(st.lastSync) : '')],
    offline: ['cloudOff', 'Offline – wird später abgeglichen'],
    error: ['cloudWarn', st.message || 'Fehler beim Abgleich'],
    'needs-auth': ['cloudWarn', 'Bitte neu verbinden'],
  };
  const [ic, text] = map[st.state] || map.off;
  $('#sync-btn').innerHTML = `${icon(ic, st.state === 'syncing' ? 'spin' : '')}<span>${esc(text)}</span>`;
  $('#sync-btn').dataset.state = st.state;
  $('#sync-btn').title = text;
  $('#list-sync').innerHTML = icon(ic, st.state === 'syncing' ? 'spin' : '');
  $('#list-sync').dataset.state = st.state;
  $('#list-sync').title = text;
}

function autoGrow() {
  const t = $('#note-title');
  t.style.height = 'auto';
  t.style.height = t.scrollHeight + 'px';
}

// ---------------- Aktionen ----------------
async function onSyncClick() {
  const st = sync.status.state;
  if (st === 'off') return openSettings();
  if (st === 'needs-auth' || (st === 'error' && !isAndroid && !sync.getClientId())) {
    if (!isAndroid && !sync.getClientId()) return openSettings();
    try { await sync.connect(); toast('Mit Google Drive verbunden'); } catch (e) { toast(e.message); }
    return;
  }
  await saveCurrent();
  sync.sync({ interactive: false });
}

async function notebookMenu(id) {
  const nb = model.find('notebook', id);
  if (!nb) return;
  const opts = [{ label: 'Umbenennen', value: 'rename' }, { label: 'Farbe ändern', value: 'color' }];
  if (id !== model.DEFAULT_NOTEBOOK) opts.push({ label: 'Notizbuch löschen', value: 'delete' });
  const act = await choose(nb.name, opts);
  if (act === 'rename') {
    const name = await promptBox('Notizbuch umbenennen', nb.name);
    if (name) { nb.name = name; await model.save('notebook', nb); }
  } else if (act === 'color') {
    const c = await choose('Farbe wählen', COLORS.map((col, i) => ({ label: ['Orange', 'Rot', 'Pink', 'Lila', 'Indigo', 'Blau', 'Türkis', 'Grün', 'Braun', 'Grau'][i], value: col, color: col })));
    if (c) { nb.color = c; await model.save('notebook', nb); }
  } else if (act === 'delete') {
    const notes = model.active('note').filter(n => n.notebookId === id);
    const ok = await confirmBox('Notizbuch löschen?',
      notes.length ? `Die ${notes.length} Notiz(en) darin werden nach „Allgemein“ verschoben.` : 'Das Notizbuch ist leer.', 'Löschen', true);
    if (!ok) return;
    for (const n of notes) { n.notebookId = model.DEFAULT_NOTEBOOK; await model.saveNote(n); }
    await model.remove('notebook', id);
    if (view.notebook === id) view.notebook = 'all';
  }
  render();
}

async function addNotebook() {
  const name = await promptBox('Neues Notizbuch', '', 'z. B. Arbeit, Privat, Einkauf');
  if (!name) return;
  const used = new Set(model.active('notebook').map(b => b.color));
  const color = COLORS.find(c => !used.has(c)) || COLORS[Math.floor(Math.random() * COLORS.length)];
  const nb = await model.save('notebook', { id: model.uid(), name, color, createdAt: Date.now() });
  view.notebook = nb.id;
  render();
}

async function moveCurrent() {
  if (!current) return;
  const target = await choose('Verschieben nach …', sortedNotebooks().map(b => ({ label: b.name, value: b.id, color: b.color })));
  if (!target || target === current.notebookId) return;
  current.notebookId = target;
  isDraft = false;
  await model.saveNote(current);
  renderMeta();
  toast('Verschoben');
}

async function noteMenu() {
  if (!current) return;
  const opts = [
    { label: 'In anderes Notizbuch verschieben', value: 'move' },
    { label: 'Duplizieren', value: 'dup' },
    { label: 'Notiz löschen', value: 'delete' },
  ];
  const act = await choose(model.noteTitle(current), opts);
  if (act === 'move') return moveCurrent();
  if (act === 'dup') {
    await saveCurrent();
    const copy = { ...current, id: model.uid(), title: model.noteTitle(current) + ' (Kopie)', createdAt: Date.now(), pinned: false };
    delete copy.dirty;
    await model.saveNote(copy);
    openNote(copy.id);
  }
  if (act === 'delete') {
    if (!(await confirmBox('Notiz löschen?', 'Die Notiz wird auf allen Geräten gelöscht.', 'Löschen', true))) return;
    const id = current.id;
    const wasDraft = isDraft;
    clearTimeout(saveTimer); saveTimer = null;
    current = null;
    if (!wasDraft) await model.remove('note', id);
    if (isQuick) { await finishQuick(); return; }
    closeEditor(true);
    toast('Notiz gelöscht');
  }
}

// ---------------- Einstellungen ----------------
function openSettings() {
  const connected = sync.isConnected();
  const body = el(`<div class="settings">
    <section>
      <h3>${icon('cloud')} Google Drive</h3>
      <p class="muted">Deine Notizen werden in einem versteckten App-Ordner in deinem Google Drive gespeichert und zwischen Handy und Computer abgeglichen.</p>
      <p class="status-line"></p>
      ${isAndroid ? '' : `<label class="field"><span>Google Client-ID (nur am Computer nötig, siehe Anleitung)</span>
        <input class="text-input" id="client-id" placeholder="123….apps.googleusercontent.com" value="${esc(sync.getClientId())}"></label>`}
      <div class="row">
        ${connected
          ? '<button class="btn primary" data-s="sync">Jetzt synchronisieren</button><button class="btn" data-s="disconnect">Trennen</button>'
          : '<button class="btn primary" data-s="connect">Mit Google Drive verbinden</button>'}
      </div>
    </section>
    <section>
      <h3>${icon('folder')} Datensicherung</h3>
      <p class="muted">Zusätzlich zur Synchronisierung kannst du alles als Datei sichern oder eine Sicherung einlesen.</p>
      <div class="row">
        ${isAndroid ? '' : '<button class="btn" data-s="export">Alles exportieren</button>'}
        <button class="btn" data-s="import">Sicherung importieren</button>
      </div>
    </section>
    <section class="muted small">Meine Notizen ${APP_VERSION} · Tipps: „[] “ + Leertaste am Zeilenanfang erzeugt ein Kontrollkästchen, „# “ eine Überschrift.</section>
  </div>`);
  const st = sync.status;
  body.querySelector('.status-line').textContent = connected
    ? `Status: ${({ ok: 'verbunden', syncing: 'synchronisiere …', offline: 'offline', error: 'Fehler – ' + st.message, 'needs-auth': 'Anmeldung abgelaufen' })[st.state] || 'verbunden'}` +
      (st.lastSync ? ` · letzter Abgleich ${relTime(st.lastSync)}` : '')
    : 'Status: nicht verbunden';
  const d = dialog({ title: 'Einstellungen', body, wide: true });
  body.querySelector('#client-id')?.addEventListener('change', e => { sync.setClientId(e.target.value); sync.preload(); });
  body.addEventListener('click', async e => {
    const act = e.target.closest('[data-s]')?.dataset.s;
    if (!act) return;
    const cid = body.querySelector('#client-id');
    if (cid) sync.setClientId(cid.value);
    try {
      if (act === 'connect') {
        if (!isAndroid && !sync.getClientId()) { toast('Bitte zuerst die Client-ID eintragen'); return; }
        await sync.connect();
        toast('Verbunden – Notizen werden abgeglichen');
        d.close();
      }
      if (act === 'sync') { await saveCurrent(); await sync.sync({ interactive: true }); toast('Abgeglichen'); d.close(); }
      if (act === 'disconnect') {
        if (await confirmBox('Google Drive trennen?', 'Die Notizen bleiben auf diesem Gerät und in Google Drive erhalten, werden aber nicht mehr abgeglichen.', 'Trennen')) {
          sync.disconnect(); d.close();
        }
      }
      if (act === 'export') exportAll();
      if (act === 'import') importBackup();
    } catch (err) { toast(err.message); }
  });
}

function exportAll() {
  const clean = x => { const { dirty, ...r } = x; return r; };
  const data = {
    app: 'meine-notizen', version: 1, exportedAt: new Date().toISOString(),
    notebooks: model.active('notebook').map(clean), notes: model.active('note').map(clean), stickers: model.active('sticker').map(clean),
  };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meine-notizen-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'meine-notizen') throw new Error('Das ist keine Sicherung von „Meine Notizen“.');
      let n = 0;
      for (const [type, list] of [['notebook', data.notebooks], ['sticker', data.stickers], ['note', data.notes]]) {
        for (const item of list || []) {
          const local = model.find(type, item.id);
          if (local && !local.deleted && (local.updatedAt || 0) >= (item.updatedAt || 0)) continue;
          if (type === 'note') await model.saveNote({ ...item }); else await model.save(type, { ...item });
          n++;
        }
      }
      toast(`${n} Einträge importiert`);
      render();
    } catch (e) { toast(e.message); }
  };
  input.click();
}

// ---------------- Ereignisse ----------------
function bindUI() {
  $('#nav').addEventListener('click', e => {
    const more = e.target.closest('[data-more]');
    if (more) { e.stopPropagation(); notebookMenu(more.dataset.more); return; }
    const item = e.target.closest('[data-nb]');
    if (!item) return;
    view.notebook = item.dataset.nb;
    app.classList.remove('drawer-open');
    if (isNarrow() && app.dataset.view === 'editor') closeEditor();
    render();
  });
  $('#nav').addEventListener('contextmenu', e => {
    const item = e.target.closest('.nb[data-nb]');
    if (item) { e.preventDefault(); notebookMenu(item.dataset.nb); }
  });
  $('#add-notebook').onclick = addNotebook;
  $('#menu-btn').onclick = () => app.classList.toggle('drawer-open');
  $('#scrim').onclick = () => app.classList.remove('drawer-open');
  $('#settings-btn').onclick = openSettings;
  $('#sync-btn').onclick = onSyncClick;
  $('#list-sync').onclick = onSyncClick;
  $('#fab').onclick = newNote;
  $('#empty-new').onclick = newNote;
  $('#search').addEventListener('input', e => { view.search = e.target.value; renderList(); });
  $('#note-list').addEventListener('click', e => {
    const item = e.target.closest('.note-item');
    if (item) openNote(item.dataset.id);
  });
  $('#back-btn').onclick = () => closeEditor();
  $('#nb-chip').onclick = moveCurrent;
  $('#note-more').onclick = noteMenu;
  $('#pin-btn').onclick = async () => {
    if (!current) return;
    current.pinned = !current.pinned;
    isDraft = false;
    await model.saveNote(current);
    renderMeta();
    toast(current.pinned ? 'Angeheftet' : 'Nicht mehr angeheftet');
  };
  $('#done-btn').onclick = finishQuick;
  $('#open-app-btn').onclick = async () => { await saveCurrent(); if (current) call('openInApp', current.id); };
  const title = $('#note-title');
  title.addEventListener('input', () => { autoGrow(); if (current) scheduleSave(); });
  title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); editor.focus(false); editor.placeCaret(editor.content.firstElementChild || editor.content, false); } });
  const flushReload = () => setTimeout(() => {
    if (pendingReload && document.activeElement !== editor.content && document.activeElement !== title) {
      const it = pendingReload; pendingReload = null; remoteUpdateOfCurrent(it, true);
    }
  }, 200);
  editor.content.addEventListener('blur', flushReload);
  title.addEventListener('blur', flushReload);

  // Schnellbearbeitung: Tipp neben die Karte schließt
  app.addEventListener('mousedown', e => { if (isQuick && e.target === app) finishQuick(); });

  document.addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'n' && !isAndroid) { e.preventDefault(); newNote(); }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveCurrent().then(() => sync.schedule(100)); }
    if (mod && e.key.toLowerCase() === 'f') { e.preventDefault(); $('#search').focus(); }
    if (e.key === 'Escape' && !document.querySelector('.modal-backdrop') && isNarrow() && app.dataset.view === 'editor') closeEditor();
  });
  window.addEventListener('beforeunload', () => { if (saveTimer) saveCurrent(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveCurrent(); });
  setInterval(() => { if (sync.status.state === 'ok') renderSync(sync.status); renderMeta(); }, 60_000);
}

init().catch(e => {
  console.error(e);
  document.body.insertAdjacentHTML('beforeend', `<div class="fatal">Die App konnte nicht starten: ${esc(e.message)}</div>`);
});
