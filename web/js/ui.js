// Kleine UI-Helfer: Dialoge, Rückfragen, Hinweise, Icons.

export const icons = {
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5z"/><path d="M12 14v6"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
  cloudOk: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M9.5 13.5l2 2 3.5-4"/>',
  cloudOff: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M4 4l16 16"/>',
  cloudSync: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M12 11v5M10 14l2 2 2-2"/>',
  cloudWarn: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/><path d="M12 10.5v3M12 15.6v.1"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  book: '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>',
  notes: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z"/>',
  italic: '<path d="M10 5h8M6 19h8M14 5l-4 14"/>',
  underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
  strike: '<path d="M4 12h16M16 6.5C15 5 13.6 4.5 12 4.5c-2.5 0-4 1.3-4 3 0 1.4 1 2.3 2.5 2.8M8 17c1 1.6 2.4 2.5 4.3 2.5 2.6 0 4.2-1.4 4.2-3.3 0-.9-.3-1.6-.9-2.2"/>',
  highlight: '<path d="M14.5 4.5l5 5L10 19H5v-5z"/><path d="M4 21h16" stroke-width="3"/>',
  check: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  bullets: '<circle cx="5" cy="7" r="1.2"/><circle cx="5" cy="12" r="1.2"/><circle cx="5" cy="17" r="1.2"/><path d="M9.5 7H20M9.5 12H20M9.5 17H20"/>',
  numbers: '<path d="M10 7h10M10 12h10M10 17h10M4 5.5l1.5-1V9M3.8 14.2c.3-.6.9-.9 1.5-.9.8 0 1.4.5 1.4 1.2 0 1-2.9 2.1-2.9 3.3h3"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-8 8"/>',
  sticker: '<path d="M20 12.5V7a3 3 0 0 0-3-3H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5.5z"/><path d="M12.5 20c0-4.1 3.4-7.5 7.5-7.5"/><circle cx="9" cy="10" r=".8"/><circle cx="15" cy="10" r=".8"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  crop: '<path d="M7 3v14h14M3 7h14v14"/>',
  magic: '<path d="M5 19L16 8M14 6l4 4"/><path d="M19 3v3M17.5 4.5h3M7 4v2M6 5h2"/>',
  rotate: '<path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  open: '<path d="M14 4h6v6M20 4l-8 8M18 14v5H5V6h5"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
};

export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || ''}</svg>`;
}

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const openDialogs = [];

/** Öffnet einen Dialog. actions: [{label, primary, danger, onClick(close) -> false hält ihn offen}] */
export function dialog({ title = '', body = '', actions = [], wide = false, onClose } = {}) {
  const root = el(`<div class="modal-backdrop"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      ${title ? `<div class="modal-head"><h2>${esc(title)}</h2><button class="icon-btn modal-x" aria-label="Schließen">${icon('close')}</button></div>` : ''}
      <div class="modal-body"></div>
      ${actions.length ? '<div class="modal-actions"></div>' : ''}
    </div></div>`);
  const bodyEl = root.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.append(body);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    root.classList.add('closing');
    const i = openDialogs.indexOf(close);
    if (i >= 0) openDialogs.splice(i, 1);
    setTimeout(() => root.remove(), 160);
    onClose && onClose();
  };
  const actionsEl = root.querySelector('.modal-actions');
  for (const a of actions) {
    const b = el(`<button class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}">${esc(a.label)}</button>`);
    b.onclick = async () => { const r = a.onClick ? await a.onClick(close) : undefined; if (r !== false) close(); };
    actionsEl.append(b);
  }
  root.querySelector('.modal-x')?.addEventListener('click', close);
  root.addEventListener('mousedown', e => { if (e.target === root) close(); });
  document.body.append(root);
  openDialogs.push(close);
  return { close, root, body: bodyEl };
}

/** Schließt den obersten Dialog (für die Zurück-Taste). */
export function closeTopDialog() {
  const c = openDialogs[openDialogs.length - 1];
  if (c) { c(); return true; }
  return false;
}

export function confirmBox(title, text, okLabel = 'OK', danger = false) {
  return new Promise(resolve => {
    let result = false;
    dialog({
      title, body: `<p>${esc(text)}</p>`,
      actions: [
        { label: 'Abbrechen' },
        { label: okLabel, primary: !danger, danger, onClick: () => { result = true; } },
      ],
      onClose: () => resolve(result),
    });
  });
}

export function promptBox(title, value = '', placeholder = '') {
  return new Promise(resolve => {
    let result = null;
    const input = el(`<input class="text-input" type="text">`);
    input.value = value;
    input.placeholder = placeholder;
    const d = dialog({
      title, body: input,
      actions: [{ label: 'Abbrechen' }, { label: 'OK', primary: true, onClick: () => { result = input.value.trim(); } }],
      onClose: () => resolve(result || null),
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { result = input.value.trim(); d.close(); } });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

/** Auswahl aus einer Liste. options: [{label, value, color?}] */
export function choose(title, options) {
  return new Promise(resolve => {
    let result = null;
    const list = el('<div class="choice-list"></div>');
    const d = dialog({ title, body: list, onClose: () => resolve(result) });
    for (const o of options) {
      const b = el(`<button class="choice">${o.color ? `<span class="dot" style="background:${esc(o.color)}"></span>` : ''}<span>${esc(o.label)}</span></button>`);
      b.onclick = () => { result = o.value; d.close(); };
      list.append(b);
    }
  });
}

let toastTimer;
export function toast(text) {
  let t = document.querySelector('.toast');
  if (!t) { t = el('<div class="toast"></div>'); document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

export function relTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Gestern';
  return d.toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
