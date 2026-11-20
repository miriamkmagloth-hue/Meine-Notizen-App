// Hauptprogramm: Ordner, Notizliste, Editor, Einstellungen.
import * as model from './model.js';
import * as sync from './sync.js';
import { Editor } from './editor.js';
import { icon, el, esc, dialog, confirmBox, promptBox, choose, toast, relTime, closeTopDialog } from './ui.js';
import { isAndroid, isQuick, isWidgetCfg, call } from './native.js';
import { pushNote, pushIndex, pushAll, applyPendingToggles } from './widget.js';
import { applyAppTheme, applyNoteStyle, appPrefs, saveAppPrefs, ACCENTS, BG_COLORS, measureLum, overlayCss, folderIcon, FOLDER_COLORS, PRESETS, COLOR_FIELDS, UI_COLORS, INK_COLORS, FONTS, setAppBgImage, setGlass, glassValues } from './theme.js';
import { openNoteStyle } from './notestyle.js';
import { startBackup, runBackup, onBackupStatus, backupStatus, rootLink } from './backup.js';
import { colorRow, segmented } from './ui.js';
import { pickImageFile, fileToDataUrl, cropDialog } from './imagetools.js';

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
  applyAppTheme();
  if (isWidgetCfg) {
    document.body.classList.add('widgetcfg');
    const { openWidgetConfig } = await import('./widgetcfg.js');
    await openWidgetConfig();
    return;
  }
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
    if (type === 'pref') applyAppTheme();
    renderSoon();
  });

  sync.onStatus(renderSync);
  sync.startAutoSync();
  startBackup();
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
  applyNoteStyle($('#editor-pane'), item.style);
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
  applyNoteStyle($('#editor-pane'), note.style);
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
  const defaults = appPrefs().noteDefaults;
  if (defaults && Object.keys(defaults).length) current.style = JSON.parse(JSON.stringify(defaults));
  isDraft = true;
  showEditor();
  applyNoteStyle($('#editor-pane'), current.style);
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
  $('#editor-pane').classList.add('is-empty');
  applyNoteStyle($('#editor-pane'), null);
  app.dataset.view = 'list';
  renderList();
}

function showEditor() {
  $('#editor-pane').classList.remove('is-empty');
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
    '<div class="nav-label">Ordner</div>' +
    sortedNotebooks().map(b => `<div class="nav-item nb ${view.notebook === b.id ? 'on' : ''}" data-nb="${esc(b.id)}" role="button" tabindex="0">
        ${folderIcon(b.color || COLORS[0])}<span class="nav-name">${esc(b.name)}</span>
        <span class="count">${count(b.id) || ''}</span>
        <button class="icon-btn nb-more" data-more="${esc(b.id)}" title="Ordner bearbeiten">${icon('more')}</button></div>`).join('');
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
        ${view.notebook === 'all' && nb ? `<span class="ni-nb">${folderIcon(nb.color)}${esc(nb.name)}</span>` : ''}
        ${n.hasImage ? icon('image', 'ni-ic') : ''}${checkProgress(n.html || '')}</div>
    </button>`;
  }).join('');
  list.querySelectorAll('.note-item').forEach(card => {
    const n = model.find('note', card.dataset.id);
    if (n?.style) applyNoteStyle(card, n.style, { card: true });
  });
}

function renderMeta() {
  if (!current) return;
  const nb = model.find('notebook', current.notebookId) || model.find('notebook', model.DEFAULT_NOTEBOOK);
  $('#nb-chip').innerHTML = `${folderIcon(nb?.color || COLORS[0])}${esc(nb?.name || 'Allgemein')}`;
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

/** Dialog für einen neuen oder bestehenden Ordner: Name und Farbe. */
function folderDialog(title, name = '', color = FOLDER_COLORS[0]) {
  return new Promise(resolve => {
    let result = null;
    let col = color;
    const body = el(`<div class="folder-form">
      <label class="field"><span>Name</span><input class="text-input" placeholder="z. B. Arbeit, Privat, Einkauf"></label>
      <div class="field"><span>Farbe</span><div class="fc"></div></div>
    </div>`);
    const input = body.querySelector('input');
    input.value = name;
    body.querySelector('.fc').append(colorRow(FOLDER_COLORS, color, c => { col = c; }));
    const done = () => { if (input.value.trim()) result = { name: input.value.trim(), color: col }; };
    const d = dialog({ title, body, actions: [{ label: 'Abbrechen' }, { label: 'Speichern', primary: true, onClick: done }], onClose: () => resolve(result) });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { done(); d.close(); } });
    setTimeout(() => input.focus(), 50);
  });
}

async function notebookMenu(id) {
  const nb = model.find('notebook', id);
  if (!nb) return;
  const opts = [{ label: 'Name & Farbe ändern', value: 'edit' }];
  if (id !== model.DEFAULT_NOTEBOOK) opts.push({ label: 'Ordner löschen', value: 'delete' });
  const act = await choose(nb.name, opts);
  if (act === 'edit') {
    const r = await folderDialog('Ordner bearbeiten', nb.name, nb.color);
    if (r) { nb.name = r.name; nb.color = r.color; await model.save('notebook', nb); }
  } else if (act === 'delete') {
    const notes = model.active('note').filter(n => n.notebookId === id);
    const ok = await confirmBox('Ordner löschen?',
      notes.length ? `Die ${notes.length} Notiz(en) darin werden nach „Allgemein“ verschoben.` : 'Der Ordner ist leer.', 'Löschen', true);
    if (!ok) return;
    for (const n of notes) { n.notebookId = model.DEFAULT_NOTEBOOK; await model.saveNote(n); }
    await model.remove('notebook', id);
    if (view.notebook === id) view.notebook = 'all';
  }
  render();
}

async function addNotebook() {
  const used = new Set(model.active('notebook').map(b => b.color));
  const suggestion = FOLDER_COLORS.find(c => !used.has(c)) || FOLDER_COLORS[0];
  const r = await folderDialog('Neuer Ordner', '', suggestion);
  if (!r) return;
  const nb = await model.save('notebook', { id: model.uid(), name: r.name, color: r.color, createdAt: Date.now() });
  view.notebook = nb.id;
  render();
}

async function moveCurrent() {
  if (!current) return;
  const target = await choose('In Ordner verschieben', sortedNotebooks().map(b => ({ label: b.name, value: b.id, iconHtml: folderIcon(b.color) })));
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
    { label: 'In anderen Ordner verschieben', value: 'move' },
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

async function editNoteStyle() {
  if (!current) return;
  const note = current;
  const pane = $('#editor-pane');
  const final = await openNoteStyle(note.style, {
    onChange: st => { applyNoteStyle(pane, st); },
  });
  if (current !== note) return;
  note.style = final;
  applyNoteStyle(pane, final);
  isDraft = isDraft && model.isEmptyNote({ ...note, text: model.htmlToText(note.html) });
  if (!isDraft) { await model.saveNote(note); renderList(); }
}

async function editNoteDefaults() {
  const final = await openNoteStyle(appPrefs().noteDefaults, {
    title: 'Standard für neue Notizen',
    hint: 'Diese Einstellungen bekommt jede neue Notiz automatisch. Bestehende Notizen bleiben, wie sie sind.',
  });
  await saveAppPrefs({ noteDefaults: final });
  toast('Standard gespeichert');
}

/** Dialog „Farben & Design“: Vorlagen, Hell/Dunkel, Akzentfarbe, eigene Farben, App-Hintergrund. */
function openDesign() {
  const body = el(`<div class="design-panel">
    <section><h3>Vorlagen</h3><div class="preset-row"></div></section>
    <section><h3>Schriftart</h3><div class="font-row"></div></section>
    <section><h3>Hell oder dunkel</h3><div class="mode-row"></div></section>
    <section><h3>Akzentfarbe</h3><p class="muted small">Knöpfe, Häkchen, Markierungen</p><div class="accent-row"></div></section>
    <section class="custom-colors"><h3>Eigene Farben</h3><div class="cf"></div><button type="button" class="btn small reset-colors">Farben der Vorlage wiederherstellen</button></section>
    <section><h3>App-Hintergrund</h3><p class="muted small">Farbe oder Foto hinter Notizliste und Seitenleiste</p><div class="appbg-type"></div><div class="appbg-panel"></div></section>
    <section class="blocks-sec"><h3>Durchsichtigkeit der Bereiche</h3><p class="muted small">Wie stark der Hintergrund durch die drei Bereiche scheint. 0 % = ganz durchsichtig, 100 % = deckend. Wirkt, wenn ein App-Hintergrund gewählt ist.</p><div class="blocks"></div></section>
    <section><h3>Neue Notizen</h3><button class="btn" data-x="defaults">${icon('textSize')} Standard-Schrift &amp; -Hintergrund festlegen</button></section>
    <p class="muted small">Gilt auf allen deinen Geräten.</p>
  </div>`);

  const presetRow = body.querySelector('.preset-row');
  const renderPresets = () => {
    const p = appPrefs();
    presetRow.innerHTML = '';
    for (const pr of PRESETS) {
      const c = pr.colors || { bg: '#1c1b1a', side: '#232120', card: '#2c2a27' };
      const b = el(`<button type="button" class="preset ${p.preset === pr.id ? 'on' : ''}"><div class="pv" style="background:${c.bg}"><i style="background:${c.side}"></i><b style="background:${c.card};border-top:3px solid ${pr.accent}"></b></div><span>${esc(pr.name)}</span></button>`);
      b.onclick = async () => {
        await saveAppPrefs({ preset: pr.id, themeMode: pr.mode, accent: pr.accent, colors: pr.colors ? { ...pr.colors } : null });
        renderAll();
      };
      presetRow.append(b);
    }
  };

  const renderFonts = () => {
    const box = body.querySelector('.font-row');
    box.innerHTML = '';
    const cur = appPrefs().font || FONTS[0].id;
    for (const f of FONTS) {
      const b = el(`<button type="button" class="font-opt ${f.id === cur ? 'on' : ''}"><span class="fo-big" style="font-family:${esc(f.display)}">Aa</span><span class="fo-name" style="font-family:${esc(f.body)}">${esc(f.name)}</span><small>${esc(f.hint)}</small></button>`);
      b.onclick = async () => { await saveAppPrefs({ font: f.id }); renderFonts(); };
      box.append(b);
    }
  };

  const renderMode = () => {
    const box = body.querySelector('.mode-row');
    box.innerHTML = '';
    box.append(segmented([{ value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }, { value: 'auto', label: 'Wie das Gerät' }],
      appPrefs().themeMode || 'light', async v => { await saveAppPrefs({ themeMode: v }); renderAll(); }));
  };

  const renderAccent = () => {
    const box = body.querySelector('.accent-row');
    box.innerHTML = '';
    box.append(colorRow(ACCENTS, appPrefs().accent || null, c => saveAppPrefs({ accent: c || null }), { noneLabel: 'Standard' }));
  };

  const renderColors = () => {
    const p = appPrefs();
    const sec = body.querySelector('.custom-colors');
    sec.classList.toggle('hidden', (p.themeMode || 'light') !== 'light');
    const box = sec.querySelector('.cf');
    box.innerHTML = '';
    const base = (PRESETS.find(x => x.id === p.preset) || PRESETS[0]).colors;
    const cur = { ...base, ...(p.colors || {}) };
    for (const f of COLOR_FIELDS) {
      const row = el(`<div class="color-field"><span>${esc(f.label)}</span></div>`);
      row.append(colorRow(f.key === 'ink' ? INK_COLORS : UI_COLORS, cur[f.key], c => {
        const colors = { ...base, ...(appPrefs().colors || {}), [f.key]: c };
        saveAppPrefs({ colors });
      }));
      box.append(row);
    }
  };
  body.querySelector('.reset-colors').onclick = async () => {
    const p = appPrefs();
    const pr = PRESETS.find(x => x.id === p.preset) || PRESETS[0];
    await saveAppPrefs({ colors: pr.colors ? { ...pr.colors } : null });
    renderColors();
  };

  // App-Hintergrund
  const panel = body.querySelector('.appbg-panel');
  let bg = { ...(appPrefs().appBg || { type: 'none' }) };
  const saveBg = () => saveAppPrefs({ appBg: { ...bg } });
  const renderBg = () => {
    panel.innerHTML = '';
    if (bg.type === 'color') panel.append(colorRow(BG_COLORS, bg.color, c => { bg.color = c; saveBg(); }));
    if (bg.type === 'image') {
      const box = el(`<div class="bg-image-box"><div class="bg-thumb"></div><div class="bg-image-tools">
        <button type="button" class="btn small pick">${icon('image')} ${bg.image ? 'Anderes Foto' : 'Foto wählen'}</button>
        <label class="dim-label">Abdunkeln <input type="range" min="-70" max="70" step="5" class="dim"> Aufhellen</label>
        <label class="dim-label">Deckkraft <input type="range" min="10" max="100" step="5" class="op"> <span class="op-val"></span></label>
</div></div>`);
      const thumb = box.querySelector('.bg-thumb');
      const upd = () => {
        thumb.style.background = bg.image ? `linear-gradient(${overlayCss(bg.dim)}, ${overlayCss(bg.dim)}), url("${bg.image}") center / cover` : '';
        thumb.style.opacity = typeof bg.opacity === 'number' ? Math.max(0.25, bg.opacity) : 1;
      };
      upd();
      const dim = box.querySelector('.dim');
      dim.value = Math.round((bg.dim || 0) * 100);
      dim.addEventListener('input', () => { bg.dim = Number(dim.value) / 100; upd(); if (bg.image) setAppBgImage(bg); });
      dim.addEventListener('change', saveBg);
      const op = box.querySelector('.op');
      const opVal = box.querySelector('.op-val');
      op.value = Math.round((typeof bg.opacity === 'number' ? bg.opacity : 1) * 100);
      opVal.textContent = op.value + ' %';
      op.addEventListener('input', () => { bg.opacity = Number(op.value) / 100; opVal.textContent = op.value + ' %'; upd(); if (bg.image) setAppBgImage(bg); });
      op.addEventListener('change', saveBg);

      box.querySelector('.pick').onclick = async () => {
        const file = await pickImageFile();
        if (!file) return;
        const url = await fileToDataUrl(file, 1600);
        const cropped = await cropDialog(url, { title: 'App-Hintergrund zuschneiden', applyLabel: 'Verwenden' });
        if (!cropped) return;
        bg = { type: 'image', image: cropped, dim: bg.dim || 0, opacity: bg.opacity ?? 1, lum: await measureLum(cropped) };
        await saveBg();
        renderBg();
      };
      panel.append(box);
    }
  };
  body.querySelector('.appbg-type').append(segmented([{ value: 'none', label: 'Keiner' }, { value: 'color', label: 'Farbe' }, { value: 'image', label: 'Foto' }], bg.type || 'none', v => {
    if (v === 'none') bg = { type: 'none' };
    if (v === 'color') bg = { type: 'color', color: bg.color || BG_COLORS[4] };
    if (v === 'image') bg = { type: 'image', image: bg.image || '', dim: bg.dim || 0, opacity: bg.opacity ?? 1, lum: bg.lum };
    if (v !== 'image' || bg.image) saveBg();
    renderBg();
  }));
  body.querySelector('[data-x=defaults]').onclick = editNoteDefaults;

  const renderBlocks = () => {
    const box = body.querySelector('.blocks');
    box.innerHTML = '';
    const vals = glassValues();
    for (const [k, label] of [['side', 'Seitenleiste'], ['list', 'Notizliste'], ['note', 'Geöffnete Notiz']]) {
      const row = el(`<label class="dim-label block-row"><span class="bl-name">${label}</span><input type="range" min="0" max="100" step="5"><span class="op-val"></span></label>`);
      const input = row.querySelector('input');
      const out = row.querySelector('.op-val');
      input.value = vals[k];
      out.textContent = vals[k] + ' %';
      input.addEventListener('input', () => { vals[k] = Number(input.value); out.textContent = input.value + ' %'; setGlass(vals); });
      input.addEventListener('change', () => saveAppPrefs({ glassBlocks: { ...vals } }));
      box.append(row);
    }
  };
  const renderAll = () => { renderPresets(); renderFonts(); renderMode(); renderAccent(); renderColors(); renderBlocks(); };
  renderAll();
  renderBg();
  dialog({ title: 'Farben & Design', body, wide: true, cls: 'sheet-compact' });
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
    <section class="backup-sec">
      <h3>${icon('folder')} Lesbare Sicherung in Google Drive</h3>
      <p class="muted">Jede Notiz wird zusätzlich als <b>Google-Dokument</b> im sichtbaren Ordner „Meine Notizen – Sicherung“ in deinem Google Drive abgelegt, sortiert nach deinen Ordnern, und nach Änderungen automatisch aktualisiert. So kommst du immer an deine Notizen – auch ganz ohne die App.</p>
      <p class="status-line backup-status"></p>
      <div class="row backup-row"></div>
    </section>
    <section>
      <h3>${icon('folder')} Datensicherung als Datei</h3>
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
  const designBtn = el(`<section><h3>${icon('palette')} Farben &amp; Design</h3><p class="muted">Vorlagen, Hell/Dunkel, Akzentfarbe, eigene Farben, App-Hintergrund und Standard für neue Notizen.</p><div class="row"><button class="btn primary">Design anpassen</button></div></section>`);
  designBtn.querySelector('button').onclick = () => { d.close(); openDesign(); };
  body.querySelector('section').after(designBtn);
  const d = dialog({ title: 'Einstellungen', body, wide: true });
  const renderBackup = () => {
    const on = !!appPrefs().backup;
    const st = body.querySelector('.backup-status');
    st.textContent = !on ? 'Status: aus'
      : backupStatus.running ? 'Status: sichert gerade …'
      : backupStatus.error ? 'Status: ' + backupStatus.error
      : backupStatus.last ? `Status: an · zuletzt gesichert ${relTime(backupStatus.last)}` : 'Status: an';
    const row = body.querySelector('.backup-row');
    row.innerHTML = '';
    if (!on) {
      const b = el('<button class="btn primary">Sicherung einschalten</button>');
      b.onclick = async () => {
        if (!sync.isConnected()) { toast('Bitte zuerst mit Google Drive verbinden'); return; }
        try {
          await saveAppPrefs({ backup: true });
          await sync.getToken(true);
          toast('Sicherung eingeschaltet – die Notizen werden jetzt abgelegt');
          renderBackup();
          await runBackup({ force: true });
        } catch (e) { toast(e.message); }
      };
      row.append(b);
    } else {
      const now = el('<button class="btn primary">Jetzt sichern</button>');
      now.onclick = async () => { try { if (backupStatus.error) await sync.getToken(true); } catch (e) { toast(e.message); return; } runBackup({ force: !!backupStatus.error }); };
      const open = el(`<a class="btn" target="_blank" rel="noopener">In Google Drive öffnen</a>`);
      open.href = rootLink();
      const off = el('<button class="btn">Ausschalten</button>');
      off.onclick = async () => { await saveAppPrefs({ backup: false }); renderBackup(); toast('Sicherung ausgeschaltet – vorhandene Dokumente bleiben in Drive'); };
      row.append(now, open, off);
    }
  };
  renderBackup();
  onBackupStatus(() => { if (document.body.contains(body)) renderBackup(); });
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
  $('#design-btn').onclick = openDesign;
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
  $('#style-btn').onclick = editNoteStyle;
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
