// Storage adapter: uses browser.storage.local / chrome.storage.local when running
// as the extension popup, falls back to localStorage under `npm run dev` so the
// app still works standalone outside the extension.

export const getExtAPI = () => {
  if (typeof browser !== 'undefined') return browser;
  if (typeof chrome !== 'undefined') return chrome;
  return null;
};

const extAPI = getExtAPI();

// Explore is extension-only (needs browser.tabs) — screens gate on this.
export const isExtensionContext = !!(extAPI && extAPI.tabs);

export async function storageGet(key, fallback) {
  if (extAPI && extAPI.storage) {
    const result = await extAPI.storage.local.get(key);
    return result[key] !== undefined ? result[key] : fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function storageSet(key, value) {
  if (extAPI && extAPI.storage) {
    await extAPI.storage.local.set({ [key]: value });
    return;
  }
  // Sandboxed embeds (e.g. a published Artifact iframe) can deny localStorage
  // access entirely -- fail silently rather than throwing out of a debounced
  // save timer, same defensive posture as storageGet's try/catch above.
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* no-op */ }
}

export async function storageRemove(key) {
  if (extAPI && extAPI.storage) {
    await extAPI.storage.local.remove(key);
    return;
  }
  try { localStorage.removeItem(key); } catch { /* no-op */ }
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Merges a reward delta's material counts into a running materials pool.
export function mergeCounts(base, delta) {
  if (!delta) return base;
  const merged = { ...base };
  for (const [id, qty] of Object.entries(delta)) {
    merged[id] = (merged[id] || 0) + qty;
  }
  return merged;
}
