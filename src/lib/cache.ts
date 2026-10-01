/**
 * 兩層快取：
 *  - 記憶體層：頁面生命週期內有效，附帶 in-flight 去重，避免多個元件
 *    同時請求同一筆資料（例如路線頁與收藏夾都盯著同一個站）。
 *  - localStorage 層：跨次瀏覽保留靜態資料（路線清單、車站清單、路線站序），
 *    ETA 之類的即時資料一律不落地。
 */

const NAMESPACE_VERSION = 'v1';
const STORAGE_PREFIX = `hkbus:${NAMESPACE_VERSION}:`;
/** localStorage 約 5MB，留一個安全邊界不把瀏覽器塞爆 */
const MAX_PERSISTED_CHARS = 2_000_000;

interface MemoryEntry {
  value: unknown;
  expiresAt: number;
}

interface StoredEntry<T> {
  /** 寫入時間 */
  at: number;
  data: T;
}

const memory = new Map<string, MemoryEntry>();
const inFlight = new Map<string, Promise<unknown>>();

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // 無痕模式或被政策封鎖時 localStorage 會直接拋錯
    return null;
  }
}

/** 記憶體快取 + in-flight 去重 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expiresAt > Date.now()) return Promise.resolve(hit.value as T);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      memory.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, promise);
  return promise;
}

function readStored<T>(storageKey: string, ttlMs: number): T | undefined {
  const store = storage();
  if (!store) return undefined;

  try {
    const raw = store.getItem(storageKey);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as StoredEntry<T>;
    if (typeof parsed?.at !== 'number' || Date.now() - parsed.at > ttlMs) {
      store.removeItem(storageKey);
      return undefined;
    }
    return parsed.data;
  } catch {
    return undefined;
  }
}

function writeStored<T>(storageKey: string, data: T): void {
  const store = storage();
  if (!store) return;

  try {
    const payload = JSON.stringify({ at: Date.now(), data } satisfies StoredEntry<T>);
    if (payload.length > MAX_PERSISTED_CHARS) return;
    store.setItem(storageKey, payload);
  } catch {
    // 配額已滿或序列化失敗：靜默放棄持久化，仍保有記憶體層
  }
}

/**
 * 持久化快取：記憶體 → localStorage → 網絡。
 * 只用於變動緩慢的靜態資料。
 */
export function persisted<T>(
  namespace: string,
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const storageKey = `${STORAGE_PREFIX}${namespace}:${key}`;

  return cached(storageKey, ttlMs, async () => {
    const hit = readStored<T>(storageKey, ttlMs);
    if (hit !== undefined) return hit;

    const value = await load();
    writeStored(storageKey, value);
    return value;
  });
}

/** 僅測試或版本升級時使用 */
export function clearCache(): void {
  memory.clear();
  inFlight.clear();
  const store = storage();
  if (!store) return;

  for (let i = store.length - 1; i >= 0; i--) {
    const key = store.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) store.removeItem(key);
  }
}
