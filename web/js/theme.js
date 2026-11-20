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
export const FOLDER_COLORS = ['#e0864a', '#e5484d', '#f2a7b5', '#d6409f', '#8e4ec6', '#b9a2f0', '#3e63dd', '#0091ff', '#8fc7f5', '#12a594', '#30a46c', '#a8d5a2', '#f5c542', '#ad7f58', '#6f6e77', '#26221e'];

/** Fertige Farbthemen. Jedes lässt sich danach einzeln anpassen. */
export const PRESETS = [
  { id: 'creme', name: 'Creme', mode: 'light', accent: '#d2693a', colors: { bg: '#f7f4ef', side: '#efeae2', card: '#ffffff', paper: '#fffdf9', ink: '#26221e' } },
  { id: 'weiss', name: 'Weiß', mode: 'light', accent: '#3e63dd', colors: { bg: '#f5f6f8', side: '#ffffff', card: '#ffffff', paper: '#ffffff', ink: '#1f2328' } },
  { id: 'rose', name: 'Rosé', mode: 'light', accent: '#d6409f', colors: { bg: '#fcf3f3', side: '#f8e4e7', card: '#ffffff', paper: '#fffafa', ink: '#3a2a2e' } },
  { id: 'salbei', name: 'Salbei', mode: 'light', accent: '#3d8b5f', colors: { bg: '#f2f6f0', side: '#e3ecdf', card: '#ffffff', paper: '#fbfdf9', ink: '#23302a' } },
  { id: 'lavendel', name: 'Lavendel', mode: 'light', accent: '#8e4ec6', colors: { bg: '#f6f3fb', side: '#ebe4f7', card: '#ffffff', paper: '#fdfbff', ink: '#2c2538' } },
  { id: 'himmel', name: 'Himmel', mode: 'light', accent: '#0a84d6', colors: { bg: '#f0f6fb', side: '#e0ecf7', card: '#ffffff', paper: '#fbfdff', ink: '#1d2b38' } },
  { id: 'sand', name: 'Sand', mode: 'light', accent: '#9c6b30', colors: { bg: '#f6f0e7', side: '#ece2d2', card: '#fffbf5', paper: '#fffbf5', ink: '#33291e' } },
  { id: 'dunkel', name: 'Dunkel', mode: 'dark', accent: '#ee8a58', colors: null },
];

export const COLOR_FIELDS = [
  { key: 'side', label: 'Seitenleiste' },
  { key: 'bg', label: 'Hintergrund' },
  { key: 'card', label: 'Notizkarten' },
  { key: 'paper', label: 'Notizpapier' },
  { key: 'ink', label: 'Schrift' },
];
export const UI_COLORS = ['#ffffff', '#fffdf9', '#f7f4ef', '#efeae2', '#f6efe3', '#fff4c7', '#ffe9dc', '#fbe4e8', '#f0e6fb', '#e3e9fb', '#e1effa', '#e2f3ea', '#eef3e2', '#eeeeee', '#d9d4cc'];
export const INK_COLORS = ['#26221e', '#1f2328', '#3a2a2e', '#23302a', '#2c2538', '#1d2b38', '#4a3b2a', '#555555'];

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
  { id: 'blank', name: 'Leer' },
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
    if (bg.pattern === 'blank') {
      out.scrollBg = '';
    } else if (bg.pattern === 'grid') {
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
    const base = r.paper || (isDark() ? '#262422' : (appPrefs().colors?.paper || '#fffdf9'));
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

export function themeMode() {
  return appPrefs().themeMode || 'light';
}

export function isDark() {
  const m = themeMode();
  return m === 'dark' || (m === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
}

export function folderIcon(color) {
  const c = color || '#e0864a';
  return `<span class="folder-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h4.1l2 2.1h7.5A2.2 2.2 0 0 1 21 9.3v8.5a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z" fill="${c}"/><path d="M3 10h18" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/></svg></span>`;
}

const UI_VARS = ['--bg', '--side', '--card', '--paper', '--ink', '--ink-2', '--ink-3', '--line', '--line-2'];

export function applyAppTheme() {
  const p = appPrefs();
  const root = document.documentElement;
  const mode = p.themeMode || 'light';
  root.dataset.theme = mode;
  const dark = isDark();
  root.classList.toggle('is-dark', dark);
  UI_VARS.forEach(v => root.style.removeProperty(v));
  if (!dark && p.colors) {
    const c = p.colors;
    if (c.bg) root.style.setProperty('--bg', c.bg);
    if (c.side) root.style.setProperty('--side', c.side);
    if (c.card) root.style.setProperty('--card', c.card);
    if (c.paper) root.style.setProperty('--paper', c.paper);
    if (c.ink) {
      const base = c.card || '#ffffff';
      root.style.setProperty('--ink', c.ink);
      root.style.setProperty('--ink-2', mix(c.ink, base, 0.36));
      root.style.setProperty('--ink-3', mix(c.ink, base, 0.56));
    }
    const lineBase = c.bg || '#f7f4ef';
    const ink = c.ink || '#26221e';
    root.style.setProperty('--line', mix(lineBase, ink, 0.09));
    root.style.setProperty('--line-2', mix(lineBase, ink, 0.15));
  }
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
  const barColor = bg.type === 'color' ? bg.color : getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', barColor));
  try { window.AndroidBridge?.setSystemBars?.(barColor, luminance(barColor) > 0.4); } catch { /* egal */ }
}

if (typeof window !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (themeMode() === 'auto') applyAppTheme(); });
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
