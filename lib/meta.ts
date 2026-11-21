// Meta (Facebook) Pixel helpers — client-side only.
//
// The Pixel ID is a public identifier (it is printed in the page source of
// every site that runs a pixel), so it is safe to ship in the bundle. The
// FateCal Web dataset ID is the fallback; NEXT_PUBLIC_META_PIXEL_ID overrides
// it if ever set. While the ID is empty every helper is a no-op, so this code
// can ship first and start reporting the moment the ID lands.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1149501650962468';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackMeta(event: string, params?: Record<string, unknown>) {
  try {
    if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
      window.fbq('track', event, params);
    }
  } catch { /* tracking must never break the app */ }
}

// Fire an event only the first time a given storage key is seen on this
// browser — used so repeat logins, refreshes and return visits do not
// double-count registrations, trials and subscriptions.
export function trackMetaOnce(storageKey: string, event: string, params?: Record<string, unknown>) {
  try {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, '1');
    trackMeta(event, params);
  } catch { /* ignore */ }
}

const REG_PENDING_KEY = 'fatecal.metaRegPending';

// Called right before a sign-in flow leaves or reloads the page, so the app
// can tell a sign-in just happened when it comes back.
export function markRegistrationPending() {
  try { localStorage.setItem(REG_PENDING_KEY, '1'); } catch { /* ignore */ }
}

// Returns true once if a sign-in was marked pending, then clears the mark.
export function consumeRegistrationPending(): boolean {
  try {
    if (localStorage.getItem(REG_PENDING_KEY) !== '1') return false;
    localStorage.removeItem(REG_PENDING_KEY);
    return true;
  } catch { return false; }
}
