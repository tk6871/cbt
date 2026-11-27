/** Bound the request and JSON read, including on WebViews without AbortSignal.timeout. */
export async function fetchJson<T>(url: string | URL, timeout: number, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {...options, signal:controller.signal});
    if (!response.ok) throw new Error(`자료를 받지 못했습니다 (${response.status}).`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timer);
  }
}
