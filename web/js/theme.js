// Personalisierung: Farben, App-Design, Aussehen einzelner Notizen.
import * as model from './model.js';

// Schriftfarben (für einzelne Wörter und ganze Notizen)
export const TEXT_COLORS = [
  '#26221e', '#6d655c', '#ffffff', '#d6453d', '#e0864a', '#d9a400', '#3a9a6a', '#12a594',
  '#2f7de1', '#3e63dd', '#8e4ec6', '#d6409f', '#9c5b2e', '#1c4e80',
];
// Hintergründe (hell, pastell und dunkel)
export const BG_COLORS = [
  '#fffdf9', '#f6efe3', '#fff4c7', '#ffe3d3', '#ffd9e4', '#f0dcff', '#dfe4ff', '#d6ecff',
  '#d5f3e6', '#e6f4d0', '#eeeeee', '#3a3633', '#1f2a37', '#22312a', '#3b2433', '#111111',
];
export const ACCENTS = ['#d2693a', '#e5484d', '#d6409f', '#c2185b', '#8e4ec6', '#5b5bd6', '#3e63dd', '#0091ff', '#12a594', '#30a46c', '#9c7a3c', '#6f6e77'];

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  if (Number.isNaN(n) || h.length !== 6) return { r: 255, g: 255, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Relative Helligkeit 0 (schwarz) … 1 (weiß) */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function mix(a, b, t) {
  const x = hexToRgb(a), y = hexToRgb(b);
  return rgbToHex({ r: x.r + (y.r - x.r) * t, g: x.g + (y.g - x.g) * t, b: x.b + (y.b - x.b) * t });
}

export const DARK_INK = '#26221e';
export const LIGHT_INK = '#f3eee7';
export const inkFor = lum => (lum > 0.36 ? DARK_INK : LIGHT_INK);

/** Effektive Helligkeit eines Fotos nach Aufhellen (+) / Abdunkeln (−) */
export function imageLum(bg) {
  const base = typeof bg.lum === 'number' ? bg.lum : 0.5;
  const d = Number(bg.dim || 0);
  return d >= 0 ? base + (1 - base) * d : base * (1 + d);
}

export function overlayCss(dim) {
  const d = Number(dim || 0);
  return d >= 0 ? `rgba(255,255,255,${d})` : `rgba(0,0,0,${-d})`;
}

function lineColor(ink) {
  const { r, g, b } = hexToRgb(ink);
  return `rgba(${r},${g},${b},0.16)`;
}

export const PATTERNS = [
  { id: 'lined', name: 'Liniert' },
  { id: 'grid', name: 'Kariert' },
  { id: 'dots', name: 'Gepunktet' },
];

/**
 * Berechnet Hintergrund und Schriftfarbe für ein Notiz-Aussehen.
 * style: { size, color, bg: { type: 'none'|'color'|'pattern'|'image', color, pattern, image, dim, lum } }
 */
export function resolveNoteStyle(style) {
  const s = style || {};
  const bg = s.bg || { type: 'none' };
  const out = { background: '', paper: '', ink: '', size: s.size || 0, lineHeight: 0, scrollBg: '' };
  let lum = null;
  if (bg.type === 'color' || bg.type === 'pattern') {
    const c = bg.color || '#fffdf9';
    lum = luminance(c);
    out.background = c;
    out.paper = c;
  } else if (bg.type === 'image' && bg.image) {
    lum = imageLum(bg);
    out.background = `linear-gradient(${overlayCss(bg.dim)}, ${overlayCss(bg.dim)}), url("${bg.image}") center / cover no-repeat`;
    out.paper = lum > 0.36 ? '#fffdf9' : '#1f1d1b';
  }
  out.ink = s.color || (lum !== null ? inkFor(lum) : '');
  if (bg.type === 'pattern') {
    const ink = out.ink || DARK_INK;
    const lc = lineColor(ink);
    const size = s.size || 17;
    const lh = Math.round(size * 1.6);
    out.lineHeight = lh;
    if (bg.pattern === 'grid') {
      out.scrollBg = `linear-gradient(${lc} 1px, transparent 1px) 0 0 / 24px 24px, linear-gradient(90deg, ${lc} 1px, transparent 1px) 0 0 / 24px 24px`;
    } else if (bg.pattern === 'dots') {
      out.scrollBg = `radial-gradient(circle, ${lc.replace('0.16', '0.35')} 1.3px, transparent 1.7px) 0 0 / 22px 22px`;
    } else {
      out.scrollBg = `repeating-linear-gradient(to bottom, transparent 0, transparent ${lh - 1}px, ${lc} ${lh - 1}px, ${lc} ${lh}px)`;
    }
  }
  return out;
}

/** Setzt das Aussehen einer Notiz auf ein Element (Editor-Bereich oder Listenkarte). */
export function applyNoteStyle(el, style, { card = false } = {}) {
  const r = resolveNoteStyle(style);
  const props = ['--note-bg', '--note-paper', '--note-ink', '--note-ink-2', '--note-ink-3', '--note-size', '--note-scroll-bg', '--note-lh'];
  props.forEach(p => el.style.removeProperty(p));
  el.classList.toggle('styled', !!(r.background || r.ink || r.size));
  el.classList.toggle('has-note-bg', !!r.background);
  el.classList.toggle('has-pattern', !!r.scrollBg);
  if (r.background) el.style.setProperty('--note-bg', r.background);
  if (r.paper) el.style.setProperty('--note-paper', r.paper);
  if (r.ink) {
    const base = r.paper || (matchMedia('(prefers-color-scheme: dark)').matches ? '#262422' : '#fffdf9');
    el.style.setProperty('--note-ink', r.ink);
    el.style.setProperty('--note-ink-2', mix(r.ink, base, 0.3));
    el.style.setProperty('--note-ink-3', mix(r.ink, base, 0.5));
  }
  if (!card && r.size) el.style.setProperty('--note-size', r.size + 'px');
  if (!card && r.scrollBg) {
    el.style.setProperty('--note-scroll-bg', r.scrollBg);
    el.style.setProperty('--note-lh', r.lineHeight + 'px');
  }
}

// ---------- App-Design ----------
export function appPrefs() {
  const p = model.find('pref', 'app');
  return p && !p.deleted ? p : { id: 'app' };
}

export async function saveAppPrefs(changes) {
  const p = { ...appPrefs(), ...changes, id: 'app' };
  await model.save('pref', p);
  applyAppTheme();
  return p;
}

export function applyAppTheme() {
  const p = appPrefs();
  const root = document.documentElement;
  if (p.accent) {
    root.style.setProperty('--accent', p.accent);
    root.style.setProperty('--accent-ink', luminance(p.accent) > 0.45 ? '#1d1410' : '#ffffff');
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-ink');
  }
  const bg = p.appBg || { type: 'none' };
  document.body.classList.toggle('has-app-bg', bg.type === 'color' || (bg.type === 'image' && !!bg.image));
  if (bg.type === 'color') {
    root.style.setProperty('--app-bg', bg.color);
  } else if (bg.type === 'image' && bg.image) {
    root.style.setProperty('--app-bg', `linear-gradient(${overlayCss(bg.dim)}, ${overlayCss(bg.dim)}), url("${bg.image}") center / cover no-repeat`);
  } else {
    root.style.removeProperty('--app-bg');
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg.type === 'color') meta.setAttribute('content', bg.color);
}

/** Durchschnittliche Helligkeit eines Bildes (für die automatische Schriftfarbe). */
export async function measureLum(src) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += luminance(rgbToHex({ r: d[i], g: d[i + 1], b: d[i + 2] }));
  return sum / (d.length / 4);
}
