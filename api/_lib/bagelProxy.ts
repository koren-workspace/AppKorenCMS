const COLLECTION_ID = "updateTime";
const BAGEL_PUBLIC_API = "https://api.bagelstudio.co/api/public";

export type BagelEnv = "stage" | "prod";

export async function updateBagelTimestampOnServer(
    id: string,
    timestamp: number,
    env: BagelEnv,
    tokens: { stage?: string; prod?: string }
): Promise<{ ok: boolean; status: number }> {
    const token = env === "prod" ? tokens.prod?.trim() : tokens.stage?.trim();
    if (!token) {
        return { ok: false, status: 500 };
    }

    const url = `${BAGEL_PUBLIC_API}/collection/${COLLECTION_ID}/items/${encodeURIComponent(id)}`;
    const response = await fetch(url, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Accept-Version": "v1",
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ timestamp }),
    });

    return { ok: response.ok, status: response.status };
}
