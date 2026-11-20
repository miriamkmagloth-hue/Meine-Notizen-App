// Datenübergabe an das Android-Widget (nur in der Android-App aktiv).
import * as model from './model.js';
import { isAndroid, call } from './native.js';

/** Wandelt eine Notiz in einfache Zeilen um, die das Widget anzeigen kann. */
export function noteToBlocks(html) {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  const out = [];
  let checkIndex = 0;
  for (const n of d.childNodes) {
    if (n.nodeType === 3) { const x = n.textContent.trim(); if (x) out.push({ t: 'p', x }); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName;
    if (/^H[1-3]$/.test(tag)) {
      const x = n.textContent.trim();
      if (x) out.push({ t: 'h', x });
    } else if (tag === 'UL' || tag === 'OL') {
      const isCheck = n.classList.contains('checklist');
      let k = 1;
      for (const li of n.children) {
        if (li.tagName !== 'LI') continue;
        const x = li.textContent.trim();
        if (isCheck) out.push({ t: 'c', x, c: li.getAttribute('data-checked') === 'true', i: checkIndex++ });
        else out.push({ t: 'b', x: (tag === 'OL' ? `${k++}. ` : '•  ') + x });
      }
    } else {
      const x = n.textContent.trim();
      if (x) out.push({ t: 'p', x });
      else if (n.querySelector?.('img.note-img') || (tag === 'IMG' && n.classList.contains('note-img'))) out.push({ t: 'p', x: '🖼  Bild' });
    }
  }
  return out;
}

export function pushNote(note) {
  if (!isAndroid || !note) return;
  if (note.deleted) { call('updateWidget', note.id, 'Notiz gelöscht', '[]'); return; }
  call('updateWidget', note.id, model.noteTitle(note), JSON.stringify(noteToBlocks(note.html)));
}

let indexTimer;
export function pushIndex() {
  if (!isAndroid) return;
  clearTimeout(indexTimer);
  indexTimer = setTimeout(() => {
    const books = Object.fromEntries(model.active('notebook').map(b => [b.id, b.name]));
    const list = model.active('note')
      .sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt))
      .map(n => ({ id: n.id, title: model.noteTitle(n), nb: books[n.notebookId] || '' }));
    call('setNoteIndex', JSON.stringify(list));
  }, 300);
}

export function pushAll() {
  if (!isAndroid) return;
  model.listOf('note').forEach(pushNote);
  pushIndex();
}

/** Abhaken im Widget → in der Notiz übernehmen. Gibt die geänderten Notiz-IDs zurück. */
export async function applyPendingToggles() {
  if (!isAndroid) return [];
  const raw = call('takePendingToggles');
  let list = [];
  try { list = JSON.parse(raw || '[]'); } catch { return []; }
  const changed = new Set();
  for (const t of list) {
    const note = model.find('note', t.n);
    if (!note || note.deleted) continue;
    const d = document.createElement('div');
    d.innerHTML = note.html;
    const li = d.querySelectorAll('ul.checklist > li')[t.i];
    if (!li) continue;
    li.setAttribute('data-checked', t.c ? 'true' : 'false');
    note.html = d.innerHTML;
    changed.add(note.id);
  }
  for (const id of changed) await model.saveNote(model.find('note', id));
  return [...changed];
}
