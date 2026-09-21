const base = "/api";

export type ApiError = { errorCode?: string; message?: string };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(base + path, {
    credentials: "include",
    ...init,
    headers,
  });
  if (res.status === 204) return undefined as T;
  const body = (await res.json().catch(() => ({}))) as ApiError & T;
  if (res.status === 401 && body.errorCode === "unauthorized") {
    window.location.assign("/login");
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(body.message || `http ${res.status}`);
  }
  return body as T;
}
