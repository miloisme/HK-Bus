/**
 * 依序處理陣列，但同時最多 concurrency 個在進行中。
 *
 * 用於「取得一條路線的 N 個站名」這類 N+1 請求：完全平行會一次開幾十個
 * 連線把瀏覽器與上游都壓垮，完全循序又太慢。
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index] as T, index);
    }
  });

  await Promise.all(runners);
  return results;
}

/** 批次分組，供需要保持順序或分階段更新的呼叫端使用 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
