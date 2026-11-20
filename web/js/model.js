// Datenmodell: Notizbücher, Notizen, eigene Sticker.
import * as db from './db.js';

export const DEFAULT_NOTEBOOK = 'default';
export const state = { notebooks: [], notes: [], stickers: [], prefs: [] };

export const STORE = { note: 'notes', notebook: 'notebooks', sticker: 'stickers', pref: 'prefs' };
const listeners = new Set();

export function onChange(fn) { listeners.add(fn); }
function emit(type, item, fromSync) { listeners.forEach(fn => fn(type, item, fromSync)); }

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function listOf(type) { return state[STORE[type]]; }
export function find(type, id) { return listOf(type).find(x => x.id === id); }

export async function load() {
  state.notebooks = await db.getAll('notebooks');
  state.notes = await db.getAll('notes');
  state.stickers = await db.getAll('stickers');
  state.prefs = await db.getAll('prefs');
  if (!find('notebook', DEFAULT_NOTEBOOK)) {
    // Das Standard-Notizbuch hat auf allen Geräten dieselbe ID und gilt als "alt",
    // damit es beim ersten Abgleich nicht doppelt entsteht.
    const nb = { id: DEFAULT_NOTEBOOK, name: 'Allgemein', color: '#e0864a', createdAt: 0, updatedAt: 0, dirty: false };
    state.notebooks.push(nb);
    await db.put('notebooks', nb);
  }
}

/** Speichert ein Element. Lokale Änderungen werden als "dirty" markiert und später hochgeladen. */
export async function save(type, item, { fromSync = false } = {}) {
  if (!fromSync) {
    item.updatedAt = Date.now();
    item.dirty = true;
  }
  const list = listOf(type);
  const i = list.findIndex(x => x.id === item.id);
  if (i >= 0) list[i] = item; else list.push(item);
  await db.put(STORE[type], item);
  emit(type, item, fromSync);
  return item;
}

export async function remove(type, id) {
  // Gelöschte Elemente bleiben als "Grabstein" erhalten, damit andere Geräte davon erfahren.
  const old = find(type, id);
  if (!old) return;
  const tomb = { id, deleted: true, notebookId: old.notebookId, createdAt: old.createdAt };
  await save(type, tomb);
}

export const active = type => listOf(type).filter(x => !x.deleted);

export function htmlToText(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  d.querySelectorAll('h1,h2,h3,p,li,div,br').forEach(el => el.append('\n'));
  return d.textContent.replace(/\n{2,}/g, '\n').trim();
}

export function noteTitle(note) {
  if (note.title && note.title.trim()) return note.title.trim();
  const first = (note.text || '').split('\n').find(l => l.trim());
  return first ? first.trim().slice(0, 60) : 'Neue Notiz';
}

export async function saveNote(note, opts) {
  note.text = htmlToText(note.html);
  note.hasImage = /<img[^>]+class="[^"]*note-img/.test(note.html || '');
  return save('note', note, opts);
}

export function newNote(notebookId) {
  return {
    id: uid(),
    notebookId: notebookId || DEFAULT_NOTEBOOK,
    title: '',
    html: '<p><br></p>',
    text: '',
    pinned: false,
    createdAt: Date.now(),
  };
}

export function isEmptyNote(note) {
  return !note.title?.trim() && !note.text?.trim() && !/<img/.test(note.html || '');
}
