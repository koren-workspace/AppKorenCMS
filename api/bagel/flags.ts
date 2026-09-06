import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBagelFlagsRequest, type FlagsBody } from "../_lib/handleBagelFlags.js";

function parseBody(raw: unknown): FlagsBody {
    if (typeof raw === "string") {
        try {
            return JSON.parse(raw) as FlagsBody;
        } catch {
            return {};
        }
    }
    return (raw ?? {}) as FlagsBody;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        const result = await handleBagelFlagsRequest(req.method ?? "GET", req.headers.authorization, parseBody(req.body), {
            firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? "",
            prodFirebaseProjectId: process.env.PROD_FIREBASE_PROJECT_ID,
            bagelToken: process.env.BAGEL_TOKEN,
            prodBagelToken: process.env.PROD_BAGEL_TOKEN,
            allowedEmails: process.env.ALLOWED_EMAILS,
        });
        if (result.body) {
            return res.status(result.status).json(result.body);
        }
        return res.status(result.status).end();
    } catch (err) {
        console.error("[bagel/flags]", err);
        return res.status(500).json({ error: "Internal server error" });
    }
}
