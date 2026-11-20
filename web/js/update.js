// Prüft (nur in der Android-App), ob es auf GitHub eine neuere Version gibt.
import { isAndroid, call } from './native.js';

export const REPO = 'miriamkmagloth-hue/Meine-Notizen-App';
export const APK_URL = `https://github.com/${REPO}/releases/latest/download/MeineNotizen.apk`;

const num = v => String(v || '').replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
function newer(a, b) {
  const x = num(a), y = num(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  }
  return false;
}

export const appVersion = () => (isAndroid ? call('getAppVersion') || '' : '');

/** Gibt { version, url } zurück, wenn eine neuere Version verfügbar ist, sonst null. */
export async function checkForUpdate() {
  if (!isAndroid || !navigator.onLine) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const rel = await res.json();
    const latest = String(rel.tag_name || '').replace(/^v/, '');
    const mine = appVersion();
    if (latest && mine && newer(latest, mine)) return { version: latest, url: APK_URL };
  } catch { /* offline o. Ä. */ }
  return null;
}
