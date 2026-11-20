// Bilder: verkleinern, zuschneiden, drehen und (in der Android-App) per KI freistellen.
import { dialog, icon, toast, el } from './ui.js';
import { isAndroid, callAsync } from './native.js';

const MAX_SIDE = 1600;

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = src;
  });
}

function hasAlpha(ctx, w, h) {
  const step = Math.max(1, Math.floor(Math.max(w, h) / 200));
  const data = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) if (data[(y * w + x) * 4 + 3] < 250) return true;
  }
  return false;
}

function canvasToUrl(canvas, preferPng) {
  const ctx = canvas.getContext('2d');
  if (preferPng && hasAlpha(ctx, canvas.width, canvas.height)) return canvas.toDataURL('image/png');
  // JPEG braucht einen Hintergrund
  const c2 = document.createElement('canvas');
  c2.width = canvas.width; c2.height = canvas.height;
  const x = c2.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c2.width, c2.height);
  x.drawImage(canvas, 0, 0);
  return c2.toDataURL('image/jpeg', 0.85);
}

/** Liest eine Bilddatei ein und verkleinert sie auf eine sinnvolle Größe. */
export async function fileToDataUrl(file, maxSide = MAX_SIDE) {
  let source;
  try { source = await createImageBitmap(file); } catch {
    source = await loadImage(URL.createObjectURL(file));
  }
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const c = document.createElement('canvas');
  c.width = Math.round(source.width * scale);
  c.height = Math.round(source.height * scale);
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return canvasToUrl(c, file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif');
}

export function pickImageFile() {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files[0] || null);
    input.click();
  });
}

async function rotate(src) {
  const img = await loadImage(src);
  const c = document.createElement('canvas');
  c.width = img.naturalHeight; c.height = img.naturalWidth;
  const x = c.getContext('2d');
  x.translate(c.width, 0);
  x.rotate(Math.PI / 2);
  x.drawImage(img, 0, 0);
  return canvasToUrl(c, true);
}

/** Begrenzungsrahmen der nicht-transparenten Pixel (für "Auf Motiv zuschneiden"). */
async function alphaBounds(src) {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let i = 0; i < w; i++) {
      if (d[(y * w + i) * 4 + 3] > 20) {
        if (i < minX) minX = i; if (i > maxX) maxX = i;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const pad = Math.round(Math.max(w, h) * 0.03);
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  return { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h };
}

async function segment(src) {
  const r = await callAsync('segmentSubject', src);
  if (r.error) throw new Error(r.error);
  return r.dataUrl;
}

/**
 * Zuschneide-Dialog. Gibt die neue Bild-URL zurück oder null bei Abbruch.
 * options.title, options.applyLabel
 */
export function cropDialog(src, { title = 'Bild bearbeiten', applyLabel = 'Übernehmen' } = {}) {
  return new Promise(resolve => {
    let working = src;
    let rect = { x: 0, y: 0, w: 1, h: 1 };
    let aspect = 0;
    let result = null;

    const body = el(`<div class="crop">
      <div class="crop-stage"><div class="crop-inner"><img class="crop-img" alt=""><div class="crop-box">
        <span class="h nw"></span><span class="h ne"></span><span class="h sw"></span><span class="h se"></span>
      </div></div></div>
      <div class="crop-tools">
        <div class="seg">
          <button data-a="0" class="on">Frei</button><button data-a="1">1:1</button><button data-a="1.3333">4:3</button><button data-a="1.7778">16:9</button>
        </div>
        <button class="btn small" data-act="rotate">${icon('rotate')} Drehen</button>
        <button class="btn small" data-act="reset">Zurücksetzen</button>
      </div>
      <div class="crop-ai">
        <span class="ai-label">${icon('magic')} KI</span>
        <button class="btn small" data-act="fit">Auf Motiv zuschneiden</button>
        <button class="btn small" data-act="cutout">Hintergrund entfernen</button>
        ${isAndroid ? '' : '<span class="hint">KI-Funktionen gibt es in der Android-App.</span>'}
      </div>
    </div>`);
    const img = body.querySelector('.crop-img');
    const box = body.querySelector('.crop-box');
    const inner = body.querySelector('.crop-inner');
    if (!isAndroid) body.querySelectorAll('[data-act=fit],[data-act=cutout]').forEach(b => { b.disabled = true; });

    const layout = () => {
      box.style.left = rect.x * 100 + '%';
      box.style.top = rect.y * 100 + '%';
      box.style.width = rect.w * 100 + '%';
      box.style.height = rect.h * 100 + '%';
    };
    const setSrc = async s => {
      working = s;
      img.src = s;
      await img.decode().catch(() => {});
      layout();
    };
    const applyAspect = () => {
      if (!aspect) return;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      // Seitenverhältnis in Bildpixeln einhalten, mittig im aktuellen Rahmen
      let wpx = rect.w * iw, hpx = rect.h * ih;
      if (wpx / hpx > aspect) wpx = hpx * aspect; else hpx = wpx / aspect;
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      rect.w = wpx / iw; rect.h = hpx / ih;
      rect.x = Math.min(Math.max(0, cx - rect.w / 2), 1 - rect.w);
      rect.y = Math.min(Math.max(0, cy - rect.h / 2), 1 - rect.h);
      layout();
    };

    // Ziehen & Größe ändern
    let drag = null;
    box.addEventListener('pointerdown', e => {
      e.preventDefault();
      const handle = e.target.classList.contains('h') ? [...e.target.classList].find(c => c !== 'h') : 'move';
      const r = inner.getBoundingClientRect();
      drag = { handle, sx: e.clientX, sy: e.clientY, start: { ...rect }, W: r.width, H: r.height };
      box.setPointerCapture(e.pointerId);
    });
    box.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = (e.clientX - drag.sx) / drag.W, dy = (e.clientY - drag.sy) / drag.H;
      const s = drag.start;
      const min = 0.05;
      let { x, y, w, h } = s;
      if (drag.handle === 'move') {
        x = Math.min(Math.max(0, s.x + dx), 1 - s.w);
        y = Math.min(Math.max(0, s.y + dy), 1 - s.h);
      } else {
        if (drag.handle.includes('w')) { x = Math.min(Math.max(0, s.x + dx), s.x + s.w - min); w = s.x + s.w - x; }
        if (drag.handle.includes('e')) { w = Math.min(Math.max(min, s.w + dx), 1 - s.x); }
        if (drag.handle.includes('n')) { y = Math.min(Math.max(0, s.y + dy), s.y + s.h - min); h = s.y + s.h - y; }
        if (drag.handle.includes('s')) { h = Math.min(Math.max(min, s.h + dy), 1 - s.y); }
        if (aspect) {
          const iw = img.naturalWidth, ih = img.naturalHeight;
          h = Math.min((w * iw / aspect) / ih, 1 - y);
          w = (h * ih * aspect) / iw;
          if (drag.handle.includes('w')) x = s.x + s.w - w;
          if (drag.handle.includes('n')) y = s.y + s.h - h;
        }
      }
      rect = { x, y, w, h };
      layout();
    });
    const end = () => { drag = null; };
    box.addEventListener('pointerup', end);
    box.addEventListener('pointercancel', end);

    body.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
      body.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
      aspect = Number(b.dataset.a);
      if (!aspect) return;
      rect = { x: 0, y: 0, w: 1, h: 1 };
      applyAspect();
    }));

    const busy = (on, text) => {
      body.classList.toggle('busy', on);
      if (on) toast(text);
    };

    body.addEventListener('click', async e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;
      try {
        if (act === 'rotate') { await setSrc(await rotate(working)); rect = { x: 0, y: 0, w: 1, h: 1 }; applyAspect(); layout(); }
        if (act === 'reset') { await setSrc(src); rect = { x: 0, y: 0, w: 1, h: 1 }; layout(); }
        if (act === 'fit') {
          busy(true, 'KI sucht das Motiv …');
          const cut = await segment(working);
          const b = await alphaBounds(cut);
          if (!b) throw new Error('Kein Motiv erkannt');
          rect = b; layout();
          toast('Rahmen auf das Motiv gesetzt');
        }
        if (act === 'cutout') {
          busy(true, 'KI entfernt den Hintergrund …');
          const cut = await segment(working);
          const b = await alphaBounds(cut);
          if (!b) throw new Error('Kein Motiv erkannt');
          await setSrc(cut);
          rect = b; layout();
          toast('Hintergrund entfernt');
        }
      } catch (err) {
        toast(err.message || String(err));
      } finally {
        busy(false);
      }
    });

    dialog({
      title, body, wide: true,
      actions: [
        { label: 'Abbrechen' },
        {
          label: applyLabel, primary: true, onClick: async () => {
            const iw = img.naturalWidth, ih = img.naturalHeight;
            const full = rect.x <= 0.001 && rect.y <= 0.001 && rect.w >= 0.999 && rect.h >= 0.999;
            if (full) { result = working; return; }
            const c = document.createElement('canvas');
            c.width = Math.max(1, Math.round(rect.w * iw));
            c.height = Math.max(1, Math.round(rect.h * ih));
            c.getContext('2d').drawImage(img, rect.x * iw, rect.y * ih, rect.w * iw, rect.h * ih, 0, 0, c.width, c.height);
            result = canvasToUrl(c, true);
          },
        },
      ],
      onClose: () => resolve(result),
    });
    setSrc(src);
  });
}
