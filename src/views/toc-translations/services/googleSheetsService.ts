const SHEETS_DEV_ENDPOINT = "/__cms_sheets__";
const SHEETS_LOOKUP_ENDPOINT = "/__cms_sheets_lookup__";
const SHEETS_PARAGRAPH_TRANSLATION_ENDPOINT = "/__cms_sheets_paragraph_translation__";
export type SheetRowByHeader = Record<string, string | number | boolean | null>;

export type SaveParagraphToSheetsParams = {
    tocId?: string | null;
    translationId?: string | null;
    partIdAndName: string;
    partId: string;
    partName: string;
    itemId: string;
    mitId: string;
    type?: string | null;
    specialSign?: string;
    role?: string;
    sentences: string[];
    hazan?: boolean | null;
    cohanim?: boolean | null;
    minyan?: boolean | null;
    dateSetId?: string;
    timestamp?: number;
    deleted?: boolean;
    spreadsheetId?: string;
    sheetName?: string;
};

export type LookupParagraphByItIdParams = {
    tocId?: string | null;
    spreadsheetId?: string;
    sheetName?: string;
    itId: string;
};

export type ParagraphLookupResult = {
    isParagraph: boolean;
    baseSentences: string[];
};

export type SaveParagraphTranslationToSheetsParams = {
    tocId?: string | null;
    translationId?: string | null;
    partIdAndName: string;
    partId: string;
    partName: string;
    itemId: string;
    mitId: string;
    baseItId: string;
    type?: string | null;
    specialSign?: string;
    role?: string;
    sentences: string[];
    hazan?: boolean | null;
    cohanim?: boolean | null;
    minyan?: boolean | null;
    dateSetId?: string;
    timestamp?: number;
    deleted?: boolean;
    spreadsheetId?: string;
    sheetName?: string;
};

function resolveSheetName(params: SaveParagraphToSheetsParams): string {
    // גיליון לפי נוסח: שם הלשונית = מזהה הנוסח (tocId), למשל sefard | edot_mizrah | ashkenaz
    if (params.tocId && String(params.tocId).trim() !== "") return String(params.tocId).trim();
    // Backward compatibility fallback
    const legacySheetName = (import.meta as any).env?.VITE_GOOGLE_SHEETS_SHEET_NAME;
    if (legacySheetName && String(legacySheetName).trim() !== "") return String(legacySheetName).trim();
    throw new Error("Missing sheetName: expected tocId (nusach tab) or VITE_GOOGLE_SHEETS_SHEET_NAME fallback");
}

function resolveSheetNameByToc(tocId?: string | null, explicitSheetName?: string): string {
    if (explicitSheetName && String(explicitSheetName).trim() !== "") {
        return String(explicitSheetName).trim();
    }
    if (tocId && String(tocId).trim() !== "") return String(tocId).trim();
    const legacySheetName = (import.meta as any).env?.VITE_GOOGLE_SHEETS_SHEET_NAME;
    if (legacySheetName && String(legacySheetName).trim() !== "") return String(legacySheetName).trim();
    throw new Error("Missing sheetName: expected tocId (nusach tab) or VITE_GOOGLE_SHEETS_SHEET_NAME fallback");
}

function toYachidFromMinyan(minyan: boolean | null | undefined): boolean | null {
    if (minyan === null || minyan === undefined) return null;
    return !minyan;
}

function boolToCellValue(value: boolean | null | undefined): string {
    if (value === null || value === undefined) return "";
    return value ? "TRUE" : "FALSE";
}

function valueOrHash(value: string | null | undefined): string {
    if (value === null || value === undefined) return "#";
    if (value.trim() === "") return "#";
    return value;
}

type TranslationLanguageRule = {
    prefix: string;
    /** הטקסט שנכתב לעמודת "שפה" בגיליון */
    sheetsLanguageLabel: string;
};

/**
 * מזהי תרגום מספריים (0-*, 1-*, …) → ערכי שפה בגיליון.
 * מזהים בסגנון נוסח (sefard-1, edot_mizrah-1) — ראו getLanguageByTranslationId: ברירת מחדל label = שם הנוסח כמו שם הלשונית.
 * סדר: קידומות ארוכות לפני קצרות (10 לפני 1).
 */
const TRANSLATION_LANGUAGE_RULES: TranslationLanguageRule[] = [
    { prefix: "0", sheetsLanguageLabel: "עברית" },
    { prefix: "10", sheetsLanguageLabel: "הרב זקס עברית" },
    { prefix: "11", sheetsLanguageLabel: "הרב זקס אנגלית" },
    { prefix: "1", sheetsLanguageLabel: "אנגלית" },
];

const TYPE_TO_SHEETS_CATEGORY: Record<string, string> = {
    body: "תוכן",
    title: "כותרת",
    identedBody: "תוכן מודגש",
    instructions: "הערות",
    smallInstructions: "הערות קצרות",
    commentary: "פירוש",
    baruchSheamar: "ברוך שאמר",
    centerAlign: "מיושר לאמצע",
    lineLine: "שורה-שורה",
    // currently not in Sheets dropdown screenshot; default fallback keeps this easy to adjust later.
    shiratHayam: "שירת הים",
};

/** חלק לפני המקף הראשון בין המזהים: 0-ashkenaz→0, sefard-1→sefard, 10-zaks→10 */
function getTranslationPrefix(translationId: string | null | undefined): string | null {
    const s = String(translationId ?? "").trim();
    const i = s.indexOf("-");
    if (i <= 0) return null;
    return s.slice(0, i);
}

function getLanguageByTranslationId(translationId: string | null | undefined): string {
    const prefix = getTranslationPrefix(translationId);
    if (!prefix) return "";
    const match = TRANSLATION_LANGUAGE_RULES.find((rule) => rule.prefix === prefix);
    if (match) return match.sheetsLanguageLabel;
    // נוסח כשם גיליון: sefard, edot_mizrah, ashkenaz — עמודת "שפה" זהה למזהה הנוסח (כמו tocId / שם הטאב)
    if (/^[a-z][a-z0-9_]*$/i.test(prefix)) return prefix;
    return "";
}

function getCategoryByType(type: string | null | undefined): string {
    if (!type) return "";
    return TYPE_TO_SHEETS_CATEGORY[type] ?? type;
}

export function splitParagraphSentences(text: string): string[] {
    return (text ?? "")
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

export async function lookupParagraphByItId(
    params: LookupParagraphByItIdParams
): Promise<ParagraphLookupResult> {
    if (!(import.meta as any).env?.DEV) return { isParagraph: false, baseSentences: [] };
    const spreadsheetId =
        params.spreadsheetId ?? (import.meta as any).env?.VITE_GOOGLE_SHEETS_SPREADSHEET_ID;
    const resolvedSheetName =
        resolveSheetNameByToc(params.tocId, params.sheetName);
    if (!spreadsheetId || !resolvedSheetName) {
        throw new Error("Missing Google Sheets config (spreadsheetId/sheetName)");
    }
    const itId = String(params.itId ?? "").trim();
    if (!itId) return { isParagraph: false, baseSentences: [] };
    const res = await fetch(SHEETS_LOOKUP_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            spreadsheetId,
            sheetName: resolvedSheetName,
            itId,
        }),
    });
    if (!res.ok) {
        throw new Error(`Failed looking up paragraph by IT_ID (${res.status})`);
    }
    const json = (await res.json()) as ParagraphLookupResult;
    return {
        isParagraph: json?.isParagraph === true,
        baseSentences: Array.isArray(json?.baseSentences) ? json.baseSentences : [],
    };
}

export async function saveParagraphTranslationToSheets(
    params: SaveParagraphTranslationToSheetsParams
): Promise<void> {
    if (!(import.meta as any).env?.DEV) return;
    const {
        partIdAndName,
        partId,
        partName,
        itemId,
        mitId,
        baseItId,
        translationId = null,
        type = null,
        specialSign = "",
        role = "",
        sentences,
        hazan = null,
        cohanim = null,
        minyan = null,
        dateSetId = "",
        timestamp = Date.now(),
        deleted = false,
        spreadsheetId = (import.meta as any).env?.VITE_GOOGLE_SHEETS_SPREADSHEET_ID,
        sheetName,
    } = params;
    const resolvedSheetName =
        resolveSheetNameByToc(params.tocId, sheetName);
    if (!spreadsheetId || !resolvedSheetName) {
        throw new Error("Missing Google Sheets config (spreadsheetId/sheetName)");
    }
    if (!Array.isArray(sentences) || sentences.length === 0) {
        throw new Error("Cannot save empty paragraph translation sentences");
    }
    const language = getLanguageByTranslationId(translationId);
    const category = getCategoryByType(type);
    const yachid = toYachidFromMinyan(minyan);
    const rowObjects: SheetRowByHeader[] = sentences.map((sentence, index) => {
        const isLast = index === sentences.length - 1;
        return {
            "חלק תפילה": partIdAndName ?? "",
            ID: partId ?? "",
            "שם": partName ?? "",
            IT_ID: index === 0 ? itemId : "",
            MIT_ID: mitId ?? "",
            "סימון": valueOrHash(specialSign),
            "תפקיד": valueOrHash(role),
            "טקסט": sentence,
            "חזן": valueOrHash(boolToCellValue(hazan)),
            "כהן": valueOrHash(boolToCellValue(cohanim)),
            "יחיד": valueOrHash(boolToCellValue(yachid)),
            "מצב": dateSetId ?? "",
            "שפה": language,
            "סיווג": category,
            "עדכון": timestamp,
            "מחוק": boolToCellValue(deleted),
            "פיסקה": boolToCellValue(!isLast),
        };
    });
    const res = await fetch(SHEETS_PARAGRAPH_TRANSLATION_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            spreadsheetId,
            sheetName: resolvedSheetName,
            baseItId,
            rowObjects,
        }),
    });
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const j = (await res.json()) as { message?: string };
            if (j?.message) detail = j.message;
        } catch {
            /* ignore */
        }
        throw new Error(`Failed saving paragraph translation to sheets (${res.status}): ${detail}`);
    }
}

export async function saveParagraphToSheets(params: SaveParagraphToSheetsParams): Promise<void> {
    if (!(import.meta as any).env?.DEV) return;
    const {
        partIdAndName,
        partId,
        partName,
        itemId,
        mitId,
        translationId = null,
        type = null,
        specialSign = "",
        role = "",
        sentences,
        hazan = null,
        cohanim = null,
        minyan = null,
        dateSetId = "",
        timestamp = Date.now(),
        deleted = false,
        spreadsheetId = (import.meta as any).env?.VITE_GOOGLE_SHEETS_SPREADSHEET_ID,
        sheetName,
    } = params;
    const resolvedSheetName = sheetName && String(sheetName).trim() !== "" ? String(sheetName).trim() : resolveSheetName(params);
    if (!spreadsheetId || !resolvedSheetName) {
        throw new Error("Missing Google Sheets config (spreadsheetId/sheetName)");
    }
    if (!Array.isArray(sentences) || sentences.length === 0) {
        throw new Error("Cannot save empty paragraph sentences");
    }

    const language = getLanguageByTranslationId(translationId);
    const category = getCategoryByType(type);
    const yachid = toYachidFromMinyan(minyan);
    const rowObjects: SheetRowByHeader[] = sentences.map((sentence, index) => {
        const isLast = index === sentences.length - 1;
        return {
            "חלק תפילה": partIdAndName ?? "",
            ID: partId ?? "",
            "שם": partName ?? "",
            IT_ID: index === 0 ? itemId : "",
            MIT_ID: mitId ?? "",
            "סימון": valueOrHash(specialSign),
            "תפקיד": valueOrHash(role),
            "טקסט": sentence,
            "חזן": valueOrHash(boolToCellValue(hazan)),
            "כהן": valueOrHash(boolToCellValue(cohanim)),
            "יחיד": valueOrHash(boolToCellValue(yachid)),
            "מצב": dateSetId ?? "",
            "שפה": language,
            "סיווג": category,
            "עדכון": timestamp,
            "מחוק": boolToCellValue(deleted),
            "פיסקה": boolToCellValue(!isLast),
        };
    });

    const res = await fetch(SHEETS_DEV_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            spreadsheetId,
            sheetName: resolvedSheetName,
            rowObjects,
        }),
    });
    if (!res.ok) {
        throw new Error(`Failed saving paragraph to sheets (${res.status})`);
    }
}
