/**
 * תצוגת שם נוסח בעברית — הנתונים ב-Firestore לעיתים שומרים slug באנגלית (למשל ashkenaz).
 */

const HEBREW = /[\u0590-\u05FF]/;

function normalizeKey(s: string): string {
    return s.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** מזהה מסמך / slug → שם תצוגה בעברית */
const NUSACH_SLUG_TO_HE: Record<string, string> = {
    ashkenaz: "אשכנז",
    sefard: "ספרד",
    sfard: "ספרד",
    sephard: "ספרד",
    sephardi: "ספרד",
    edot_mizrah: "עדות המזרח",
    edot_mizrach: "עדות המזרח",
    mizrah: "עדות המזרח",
    mizrach: "עדות המזרח",
    edot: "עדות המזרח",
    nusach_ashkenaz: "אשכנז",
    nusach_sefard: "ספרד",
    nusach_edot_mizrah: "עדות המזרח",
};

function inferHeFromSlug(slug: string): string | null {
    const s = slug.toLowerCase();
    if (s.includes("ashkenaz") || s.includes("אשכנז")) return "אשכנז";
    if (s.includes("mizrah") || s.includes("מזרח") || s.includes("edot")) return "עדות המזרח";
    if (s.includes("sefard") || s.includes("sfard") || s.includes("sephard")) return "ספרד";
    return null;
}

/**
 * מחזיר תווית עברית לרשימת נוסחים / כפתורים — אם כבר יש עברית ב־storedNusach משתמשים בה.
 */
export function getNusachDisplayLabel(tocId: string, storedNusach?: string | null): string {
    const id = (tocId ?? "").trim();
    const raw = (storedNusach ?? "").trim();
    if (HEBREW.test(raw)) return raw;

    const byId = id ? NUSACH_SLUG_TO_HE[normalizeKey(id)] : undefined;
    if (byId) return byId;

    if (raw) {
        const byRaw = NUSACH_SLUG_TO_HE[normalizeKey(raw)];
        if (byRaw) return byRaw;
    }

    const inferred = (id && inferHeFromSlug(id)) || (raw ? inferHeFromSlug(raw) : null);
    if (inferred) return inferred;

    return raw || id;
}
