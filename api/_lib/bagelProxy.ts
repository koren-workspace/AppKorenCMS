/**
 * bagelProxy – the server-side BagelDB client the Vercel Functions use.
 *
 * The Bagel write token lives ONLY in the server environment (BAGEL_TOKEN /
 * PROD_BAGEL_TOKEN); the browser talks to `/api/bagel/*`, never to Bagel.
 *
 * BAGEL WRITE GOTCHA (proven on stage 2026-08-30): `PUT /items/{id}/field/{slug}`
 * answers 200 and writes NOTHING. Only a whole-item `PUT /items/{id}` with a
 * (possibly partial) body persists, and a partial body does NOT clear the
 * fields it omits. Every write here is therefore a whole-item PUT.
 */

const BAGEL_PUBLIC_API = "https://api.bagelstudio.co/api/public";

export type BagelEnv = "stage" | "prod";

export type BagelTokens = { stage?: string; prod?: string };

function tokenFor(env: BagelEnv, tokens: BagelTokens): string | undefined {
    const token = env === "prod" ? tokens.prod?.trim() : tokens.stage?.trim();
    return token || undefined;
}

function headers(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        "Accept-Version": "v1",
        "Content-Type": "application/json",
    };
}

/** `fetch` is injectable so the handlers can be unit-tested without a network. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** All items of a collection (Bagel answers a bare array or `{ items }`). */
export async function listBagelItems(
    collection: string,
    env: BagelEnv,
    tokens: BagelTokens,
    fetchImpl: FetchLike = fetch
): Promise<{ ok: boolean; status: number; items: Array<Record<string, unknown>> }> {
    const token = tokenFor(env, tokens);
    if (!token) return { ok: false, status: 500, items: [] };
    const response = await fetchImpl(`${BAGEL_PUBLIC_API}/collection/${encodeURIComponent(collection)}/items`, {
        headers: headers(token),
    });
    if (!response.ok) return { ok: false, status: response.status, items: [] };
    const body: unknown = await response.json().catch(() => null);
    const items = Array.isArray(body)
        ? body
        : Array.isArray((body as { items?: unknown })?.items)
            ? (body as { items: unknown[] }).items
            : [];
    return { ok: true, status: response.status, items: items as Array<Record<string, unknown>> };
}

/** Whole-item PUT with a partial body (see the gotcha above). */
export async function putBagelItem(
    collection: string,
    id: string,
    body: Record<string, unknown>,
    env: BagelEnv,
    tokens: BagelTokens,
    fetchImpl: FetchLike = fetch
): Promise<{ ok: boolean; status: number }> {
    const token = tokenFor(env, tokens);
    if (!token) return { ok: false, status: 500 };
    const url = `${BAGEL_PUBLIC_API}/collection/${encodeURIComponent(collection)}/items/${encodeURIComponent(id)}`;
    const response = await fetchImpl(url, { method: "PUT", headers: headers(token), body: JSON.stringify(body) });
    return { ok: response.ok, status: response.status };
}

/** Create an item (used only when a flag collection is empty). */
export async function postBagelItem(
    collection: string,
    body: Record<string, unknown>,
    env: BagelEnv,
    tokens: BagelTokens,
    fetchImpl: FetchLike = fetch
): Promise<{ ok: boolean; status: number }> {
    const token = tokenFor(env, tokens);
    if (!token) return { ok: false, status: 500 };
    const url = `${BAGEL_PUBLIC_API}/collection/${encodeURIComponent(collection)}/items`;
    const response = await fetchImpl(url, { method: "POST", headers: headers(token), body: JSON.stringify(body) });
    return { ok: response.ok, status: response.status };
}

/** The original update-time write, unchanged in behaviour. */
export async function updateBagelTimestampOnServer(
    id: string,
    timestamp: number,
    env: BagelEnv,
    tokens: BagelTokens
): Promise<{ ok: boolean; status: number }> {
    return putBagelItem("updateTime", id, { timestamp }, env, tokens);
}
