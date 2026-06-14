import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleBagelUpdateTimeRequest, type BagelUpdateTimeBody } from "../../server/handleBagelUpdateTime";

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const body = (req.body ?? {}) as BagelUpdateTimeBody;
    const authHeader = req.headers.authorization;

    const result = await handleBagelUpdateTimeRequest(req.method ?? "GET", authHeader, body, {
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
}
