/**
 * Platform detection. PCs (mouse + keyboard) get the pointer-locked in-game cursor,
 * phones / tablets get the touch layout. A manual override lives in Settings.
 */
export type Platform = 'pc' | 'mobile';
export type PlatformPref = 'auto' | 'pc' | 'mobile';

const KEY = 'nenbrawl.platform';

export function detectPlatform(): Platform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'pc';
  const ua = navigator.userAgent || '';
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData;
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini|IEMobile|webOS/i.test(ua) || uaData?.mobile === true;
  const iPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  if (mobileUA || iPadOS) return 'mobile';
  const mm = (q: string) => !!window.matchMedia?.(q).matches;
  // a touch-only primary input with no hover = phone / tablet; touchscreen laptops keep a fine pointer
  if (mm('(pointer: coarse)') && mm('(hover: none)') && !mm('(any-pointer: fine)')) return 'mobile';
  return 'pc';
}

export function getPref(): PlatformPref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'pc' || v === 'mobile' || v === 'auto') return v;
  } catch { /* ignore */ }
  return 'auto';
}

export function setPref(p: PlatformPref) {
  try { localStorage.setItem(KEY, p); } catch { /* ignore */ }
}

export function resolvePlatform(): Platform {
  const p = getPref();
  return p === 'auto' ? detectPlatform() : p;
}
