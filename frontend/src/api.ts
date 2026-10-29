const KEY = "jobradar.token";

// Empty when the website and the API share one address (Docker, dev proxy). On hosting where they are
// separate, such as Vercel plus Render, the API address is set at build time with VITE_API_BASE.
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? "").replace(/\/+$/, "");

export const tokenStore = {
  get: () => localStorage.getItem(KEY),
  set: (token: string) => localStorage.setItem(KEY, token),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function failure(res: Response): Promise<ApiError> {
  let message = res.statusText || "Something went wrong";
  try {
    const body = await res.json();
    if (typeof body.detail === "string") message = body.detail;
    else if (Array.isArray(body.detail)) message = body.detail.map((d: { msg: string }) => d.msg).join(", ");
  } catch {
    /* the body was not JSON */
  }
  if (res.status === 401 && tokenStore.get()) {
    tokenStore.clear(); // the session ended: send the user back to the sign-in page
    window.dispatchEvent(new Event("jobradar:logout"));
  }
  return new ApiError(res.status, message);
}

function headers(json: boolean): HeadersInit {
  const h: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h["Content-Type"] = "application/json";
  return h;
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  form?: FormData;
}

export async function api<T>(path: string, { method = "GET", body, form }: Options = {}): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    method,
    headers: headers(body !== undefined),
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (!res.ok) throw await failure(res);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Reads the cover letter as it is written. EventSource cannot send our auth header, so fetch is used. */
export async function streamCoverLetter(
  jobId: number,
  tone: string,
  onText: (piece: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/ai/cover-letter`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({ job_id: jobId, tone }),
    signal,
  });
  if (!res.ok || !res.body) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      if (!event.startsWith("data: ")) continue;
      const data = event.slice(6);
      if (data === "[DONE]") return;
      onText(JSON.parse(data).t as string);
    }
  }
}

/** Where "Apply" goes: the company's web page or an email address. Anything else
 *  (javascript:, data:) is refused, so a saved link can never run code. */
export function applyTarget(url: string): { kind: "web" | "mail"; href: string } | null {
  if (/^https?:\/\//i.test(url)) return { kind: "web", href: url };
  if (/^mailto:[^\s?@]+@[^\s?@]+\.[^\s?@]+$/i.test(url)) return { kind: "mail", href: url };
  return null;
}

export function mailtoLink(base: string, subject: string, body: string): string {
  return `${base}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
