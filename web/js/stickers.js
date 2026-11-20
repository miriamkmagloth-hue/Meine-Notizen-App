// Eingebaute Sticker (eigene Zeichnungen) und eigene Sticker aus Fotos.
import * as model from './model.js';
import { dialog, el, esc, icon, toast, confirmBox } from './ui.js';
import { pickImageFile, fileToDataUrl, cropDialog } from './imagetools.js';

const OUT = 'stroke="#fff" stroke-width="5" stroke-linejoin="round" paint-order="stroke"';
const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g filter="url(#s)">${inner}</g><defs><filter id="s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".22"/></filter></defs></svg>`;
const label = (text, color, w = 84) => svg(`<rect x="${(100 - w) / 2}" y="32" width="${w}" height="36" rx="10" fill="${color}" ${OUT}/><text x="50" y="56.5" font-family="system-ui,sans-serif" font-size="15" font-weight="800" fill="#fff" text-anchor="middle" letter-spacing=".5">${text}</text>`);

const BUILTIN = [
  ['herz', svg(`<path d="M50 84C22 64 10 48 10 32c0-11 9-19 19-19 9 0 16 5 21 12 5-7 12-12 21-12 10 0 19 8 19 19 0 16-12 32-40 52z" fill="#ff6b81" ${OUT}/><path d="M26 28c2-4 6-6 10-6" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>`)],
  ['stern', svg(`<path d="M50 8l12 26 28 3-21 19 6 28-25-14-25 14 6-28-21-19 28-3z" fill="#ffc93c" ${OUT}/>`)],
  ['erledigt-haken', svg(`<circle cx="50" cy="50" r="38" fill="#3dbb7c" ${OUT}/><path d="M32 51l12 12 25-26" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)],
  ['achtung', svg(`<path d="M50 10l42 74H8z" fill="#ff8a3d" ${OUT}/><rect x="45" y="36" width="10" height="26" rx="5" fill="#fff"/><circle cx="50" cy="72" r="5.5" fill="#fff"/>`)],
  ['idee', svg(`<path d="M50 10c-17 0-29 13-29 28 0 11 6 18 11 23 3 3 4 6 4 10h28c0-4 1-7 4-10 5-5 11-12 11-23 0-15-12-28-29-28z" fill="#ffd84d" ${OUT}/><rect x="36" y="74" width="28" height="12" rx="5" fill="#8d99ae" ${OUT}/><path d="M42 50c3-6 13-6 16 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>`)],
  ['sonne', svg(`<g stroke="#ffb52e" stroke-width="7" stroke-linecap="round"><path d="M50 6v12M50 82v12M6 50h12M82 50h12M19 19l8 8M73 73l8 8M19 81l8-8M73 27l8-8"/></g><circle cx="50" cy="50" r="22" fill="#ffcf3f" ${OUT}/>`)],
  ['wolke', svg(`<path d="M27 74h47c11 0 18-8 18-17s-7-16-16-17c-2-13-12-21-25-21-11 0-20 7-23 17-10 1-18 9-18 19 0 11 8 19 17 19z" fill="#a9d8ff" ${OUT}/>`)],
  ['kaffee', svg(`<path d="M18 38h52v20c0 15-11 26-26 26S18 73 18 58z" fill="#c98b5b" ${OUT}/><path d="M70 44h6c7 0 11 5 11 10s-4 10-11 10h-7" fill="none" stroke="#c98b5b" stroke-width="7"/><path d="M33 14c-4 5 4 9 0 15M45 12c-4 5 4 9 0 15M57 14c-4 5 4 9 0 15" stroke="#b9a89a" stroke-width="4" fill="none" stroke-linecap="round"/>`)],
  ['blume', svg(`<g fill="#ff9ec4" ${OUT}><circle cx="50" cy="26" r="16"/><circle cx="73" cy="43" r="16"/><circle cx="64" cy="70" r="16"/><circle cx="36" cy="70" r="16"/><circle cx="27" cy="43" r="16"/></g><circle cx="50" cy="50" r="12" fill="#ffd34d"/>`)],
  ['pin', svg(`<path d="M50 60v32" stroke="#7b8794" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="38" r="26" fill="#ef4f4f" ${OUT}/><circle cx="41" cy="30" r="7" fill="#fff" opacity=".55"/>`)],
  ['pfeil', svg(`<path d="M10 40h48V20l34 30-34 30V60H10z" fill="#5b8def" ${OUT}/>`)],
  ['funkeln', svg(`<path d="M40 12c3 18 10 25 28 28-18 3-25 10-28 28-3-18-10-25-28-28 18-3 25-10 28-28z" fill="#b388ff" ${OUT}/><path d="M74 54c2 10 6 14 16 16-10 2-14 6-16 16-2-10-6-14-16-16 10-2 14-6 16-16z" fill="#ffc93c" ${OUT}/>`)],
  ['smiley', svg(`<circle cx="50" cy="50" r="38" fill="#ffd84d" ${OUT}/><circle cx="37" cy="42" r="5" fill="#4a3b2a"/><circle cx="63" cy="42" r="5" fill="#4a3b2a"/><path d="M33 58c8 12 26 12 34 0" stroke="#4a3b2a" stroke-width="5" fill="none" stroke-linecap="round"/>`)],
  ['frage', svg(`<circle cx="50" cy="50" r="38" fill="#9b7bf0" ${OUT}/><path d="M38 40c0-8 6-13 13-13 8 0 13 5 13 12 0 10-13 10-13 21" stroke="#fff" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="51" cy="73" r="5" fill="#fff"/>`)],
  ['kalender', svg(`<rect x="14" y="20" width="72" height="66" rx="10" fill="#fff" stroke="#e8e8e8" stroke-width="2"/><path d="M14 30a10 10 0 0 1 10-10h52a10 10 0 0 1 10 10v8H14z" fill="#ef4f4f"/><rect x="30" y="12" width="7" height="16" rx="3.5" fill="#555"/><rect x="63" y="12" width="7" height="16" rx="3.5" fill="#555"/><g fill="#d0d4da"><rect x="26" y="48" width="11" height="9" rx="2"/><rect x="45" y="48" width="11" height="9" rx="2"/><rect x="64" y="48" width="11" height="9" rx="2"/><rect x="26" y="64" width="11" height="9" rx="2"/><rect x="45" y="64" width="11" height="9" rx="2" fill="#ef4f4f"/></g>`)],
  ['wichtig', label('WICHTIG', '#e5484d')],
  ['todo', label('TO-DO', '#3e7bfa')],
  ['erledigt', label('ERLEDIGT', '#2fa36b', 90)],
  ['frist', label('FRIST', '#f08c00', 70)],
  ['notiz', label('NOTIZ', '#8a6cf0', 70)],
];

export const builtinStickers = BUILTIN.map(([id, s]) => ({ id, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s) }));

export async function addCustomSticker(src) {
  const st = { id: model.uid(), src, createdAt: Date.now() };
  await model.save('sticker', st);
  return st;
}

/** Sticker-Auswahl. Gibt die Bild-URL des gewählten Stickers zurück. */
export function pickSticker() {
  return new Promise(resolve => {
    let result = null;
    const body = el(`<div class="sticker-picker">
      <div class="tabs"><button class="on" data-tab="b">Sticker</button><button data-tab="c">Meine Sticker</button></div>
      <div class="sticker-grid" data-grid="b"></div>
      <div class="sticker-grid hidden" data-grid="c"></div>
    </div>`);
    const d = dialog({ title: 'Sticker einfügen', body, wide: true, onClose: () => resolve(result) });
    const gridB = body.querySelector('[data-grid=b]');
    const gridC = body.querySelector('[data-grid=c]');
    for (const s of builtinStickers) {
      const b = el(`<button class="sticker-cell"><img alt="" src="${esc(s.src)}"></button>`);
      b.onclick = () => { result = s.src; d.close(); };
      gridB.append(b);
    }
    const renderCustom = () => {
      gridC.innerHTML = '';
      const add = el(`<button class="sticker-cell add">${icon('plus')}<span>Aus Foto</span></button>`);
      add.onclick = async () => {
        const file = await pickImageFile();
        if (!file) return;
        const url = await fileToDataUrl(file, 800);
        const cut = await cropDialog(url, { title: 'Sticker zuschneiden', applyLabel: 'Als Sticker speichern' });
        if (cut) { await addCustomSticker(cut); toast('Sticker gespeichert'); renderCustom(); }
      };
      gridC.append(add);
      for (const s of model.active('sticker').sort((a, b) => b.createdAt - a.createdAt)) {
        const b = el(`<div class="sticker-cell"><img alt="" src="${esc(s.src)}"><button class="del" aria-label="Löschen">${icon('close')}</button></div>`);
        b.querySelector('img').onclick = () => { result = s.src; d.close(); };
        b.querySelector('.del').onclick = async () => {
          if (await confirmBox('Sticker löschen?', 'Der Sticker verschwindet aus „Meine Sticker“. In Notizen bleibt er erhalten.', 'Löschen', true)) {
            await model.remove('sticker', s.id); renderCustom();
          }
        };
        gridC.append(b);
      }
    };
    renderCustom();
    body.querySelectorAll('.tabs button').forEach(t => t.addEventListener('click', () => {
      body.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === t));
      gridB.classList.toggle('hidden', t.dataset.tab !== 'b');
      gridC.classList.toggle('hidden', t.dataset.tab !== 'c');
    }));
  });
}
