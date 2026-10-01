export class ApiError extends Error {
  readonly status: number | undefined;
  readonly url: string;

  constructor(message: string, url: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.url = url;
    this.status = status;
  }
}

export interface RequestOptions {
  /** 單次請求逾時，預設 12 秒 */
  timeoutMs?: number;
  /** 失敗重試次數（不含首次嘗試），預設 2 */
  retries?: number;
  /** 由呼叫端傳入，用於元件卸載時取消 */
  signal?: AbortSignal;
  headers?: Record<string, string>;
  accept?: string;
}

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 4_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 指數退避 + 隨機抖動，避免大量裝置同時重試打爆上游 */
function backoffDelay(attempt: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return Math.round(exponential * (0.7 + Math.random() * 0.6));
}

/** 4xx（429 除外）重試沒有用，直接失敗可省下往返 */
function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * 將外部 signal 與逾時用的 signal 串起來。
 * 回傳 dispose() 供呼叫端移除監聽，避免長時間輪詢下洩漏監聽器。
 */
function createLinkedController(external: AbortSignal | undefined): {
  controller: AbortController;
  dispose: () => void;
} {
  const controller = new AbortController();
  if (!external) return { controller, dispose: () => {} };

  const onAbort = () => controller.abort();
  if (external.aborted) controller.abort();
  else external.addEventListener('abort', onAbort, { once: true });

  return { controller, dispose: () => external.removeEventListener('abort', onAbort) };
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === 'AbortError' ? '請求逾時' : error.message;
  }
  return String(error);
}

type AttemptOutcome =
  | { kind: 'success'; response: Response }
  | { kind: 'failure'; error: ApiError; retryable: boolean };

async function attemptOnce(
  url: string,
  options: RequestOptions,
): Promise<AttemptOutcome> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal, headers, accept } = options;
  const { controller, dispose } = createLinkedController(signal);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: accept ?? 'application/json', ...headers },
      signal: controller.signal,
    });

    if (response.ok) return { kind: 'success', response };

    return {
      kind: 'failure',
      error: new ApiError(`HTTP ${response.status} ${response.statusText}`, url, response.status),
      retryable: isRetryableStatus(response.status),
    };
  } catch (error) {
    // 逾時與網路層錯誤都可以重試
    return {
      kind: 'failure',
      error: new ApiError(describeError(error), url),
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
    dispose();
  }
}

/** 帶逾時、重試與取消的 fetch。回傳原始 Response 供呼叫端讀取 body。 */
export async function request(url: string, options: RequestOptions = {}): Promise<Response> {
  const { retries = DEFAULT_RETRIES, signal } = options;
  let lastError = new ApiError(`Request failed: ${url}`, url);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const outcome = await attemptOnce(url, options);

    if (outcome.kind === 'success') return outcome.response;

    // 呼叫端主動取消時直接放棄，不再重試
    if (signal?.aborted) throw new ApiError('請求已取消', url);

    lastError = outcome.error;
    if (!outcome.retryable || attempt === retries) throw outcome.error;

    await sleep(backoffDelay(attempt));
  }

  throw lastError;
}

/**
 * 讀取 JSON。T 由呼叫端指定，對應上游 API 的實際回應結構；
 * adapter 負責把這些上游型別轉成領域模型。
 *
 * 某些端點在沒有資料時會回 200 加上空 body（例如 NLB 的 ETA 查詢），
 * 這種情況回傳 null 而不是讓 JSON.parse 炸掉。
 */
export async function fetchJson<T>(url: string, options: RequestOptions = {}): Promise<T | null> {
  const response = await request(url, options);
  const body = await response.text();
  if (body.trim() === '') return null;
  return JSON.parse(body) as T;
}

export async function fetchText(url: string, options: RequestOptions = {}): Promise<string> {
  const response = await request(url, { accept: '*/*', ...options });
  return response.text();
}
