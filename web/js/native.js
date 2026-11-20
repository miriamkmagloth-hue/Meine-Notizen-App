// Verbindung zur Android-App (nur vorhanden, wenn die Web-App in der Android-Hülle läuft).
const bridge = window.AndroidBridge || null;
export const isAndroid = !!bridge;
export const isQuick = (() => {
  try { return isAndroid && bridge.isQuickEdit(); } catch { return false; }
})();

const pending = new Map();
let seq = 0;

window.__nativeCallback = (id, json) => {
  const resolve = pending.get(id);
  if (!resolve) return;
  pending.delete(id);
  try { resolve(JSON.parse(json)); } catch { resolve({ error: 'Ungültige Antwort' }); }
};

/** Ruft eine asynchrone Android-Funktion auf; das Ergebnis kommt über einen Callback zurück. */
export function callAsync(method, ...args) {
  if (!bridge) return Promise.resolve({ error: 'Nur in der Android-App verfügbar' });
  return new Promise(resolve => {
    const id = 'cb' + (++seq);
    pending.set(id, resolve);
    try { bridge[method](...args, id); } catch (e) { pending.delete(id); resolve({ error: String(e) }); }
  });
}

export function call(method, ...args) {
  if (!bridge) return null;
  try { return bridge[method](...args); } catch (e) { console.warn(method, e); return null; }
}
