// Cache duration mặc định: 5 phút
const DEFAULT_CACHE_DURATION = 5 * 60 * 1000;

export function getApiCache<T = any>(key: string, duration = DEFAULT_CACHE_DURATION): T | null {
  try {
    const item = localStorage.getItem(key);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (Date.now() - parsed.timestamp < duration) {
      return parsed.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function setApiCache(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

export async function fetchWithApiCache<T = any>(key: string, url: string, options: RequestInit = {}, duration = DEFAULT_CACHE_DURATION): Promise<T> {
  const cached = getApiCache<T>(key, duration);
  if (cached) return cached;
  const res = await fetch(url, options);
  const data = await res.json();
  setApiCache(key, data);
  return data;
} 