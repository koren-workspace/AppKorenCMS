/**
 * גוף הערך: טקסט עם סימונים ⇄ בלוקים של האפליקציה.
 *
 * הפורמט שהעורכים מכירים מהגיליון: פסקאות מופרדות בשורה ריקה, ושורה
 * ראשונה של פסקה יכולה להתחיל בסימון:
 *   "## "  כותרת משנה
 *   "> "   ציטוט שאינו פסוק מזוהה (פסוקים מזוהים יושבים בשדה quotes)
 *   "~ "   הערה מדעית
 * כל פסקה אחרת היא פסקת טקסט רגילה. הסימון חל על השורה הראשונה בלבד; טקסט
 * אחרי שבירת שורה בודדת באותה פסקה הופך לפסקה נפרדת (כמו sheet.ts באפליקציה).
 *
 * הבלוקים כאן זהים ל-Block באפליקציה (src/content/types.ts) חוץ מתמונות
 * ופסוקים מזוהים, שיש להם שדות משלהם בערך ומתווספים בזמן הפרסום.
 */

export type BodyBlock =
    | { t: "p"; x: string }
    | { t: "h"; x: string }
    | { t: "q"; x: string }
    | { t: "sci"; x: string };

const MARKERS: { prefix: string; t: BodyBlock["t"] }[] = [
    { prefix: "## ", t: "h" },
    { prefix: "~ ", t: "sci" },
    { prefix: "> ", t: "q" },
];

function splitBlankLines(s: string): string[] {
    return s
        .replace(/\r/g, "")
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(Boolean);
}

/** טקסט עם סימונים → בלוקים */
export function bodyToBlocks(body: string): BodyBlock[] {
    const out: BodyBlock[] = [];
    for (const chunk of splitBlankLines(body)) {
        const nl = chunk.indexOf("\n");
        const first = (nl >= 0 ? chunk.slice(0, nl) : chunk).trim();
        const rest = nl >= 0 ? chunk.slice(nl + 1).trim() : "";
        const marker = MARKERS.find(m => first.startsWith(m.prefix));
        if (marker) {
            const x = first.slice(marker.prefix.length).trim();
            if (x) out.push({ t: marker.t, x });
            if (rest) out.push({ t: "p", x: rest });
        } else {
            out.push({ t: "p", x: chunk });
        }
    }
    return out;
}

/** בלוקים → טקסט עם סימונים (ההפך של bodyToBlocks) */
export function blocksToBody(blocks: readonly BodyBlock[]): string {
    return blocks
        .map(b => {
            const x = b.x.trim();
            switch (b.t) {
                case "h": return `## ${x}`;
                case "sci": return `~ ${x}`;
                case "q": return `> ${x}`;
                default: return x;
            }
        })
        .filter(Boolean)
        .join("\n\n");
}

/** טקסט ללא סימונים, לחיפוש ולספירת מילים */
export function bodyPlainText(body: string): string {
    return bodyToBlocks(body).map(b => b.x).join("\n");
}
