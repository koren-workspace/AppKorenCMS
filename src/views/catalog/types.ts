/**
 * catalog – קטלוג התוספות (Mods / שערים לתפילה) של האפליקציה, קולקציית
 * Firestore `catalog/{storeId}`, בכל סביבה. ראו docs/catalog.md.
 *
 * האפליקציה החדשה (koren-tefilla, services/remote/enhancements.ts) קוראת את
 * כל הקולקציה בכל כניסה לחנות. האפליקציות הישנות עדיין קוראות את הקטלוג
 * מ-Bagel; שינוי כאן לא מגיע אליהן.
 */

export type CatalogEnv = "stage" | "prod";

export const KINDS = ["translation", "commentary", "preparation", "improved", "narration"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABELS: Record<Kind, string> = {
    translation: "תרגום",
    commentary: "פירוש",
    preparation: "הכנה לתפילה",
    improved: "תפילה מכוונת",
    narration: "הקראה",
};

/** הערכים ש-nusachId מקבל; ריק = לכל הנוסחים */
export const NUSACH_IDS = ["", "Ashkenaz", "Sefard"] as const;
export const NUSACH_LABELS: Record<string, string> = { "": "כל הנוסחים", Ashkenaz: "אשכנז", Sefard: "ספרד" };

/** טקסט דו-לשוני: `default` אנגלית (חובה בכותרת), `he` עברית */
export type Localized = { default: string; he: string };

export type Track = {
    id: string;
    /** מפתח מיון; האפליקציה מציגה לפי rank בסדר יורד */
    rank: string;
    title: Localized;
    type: "audio" | "video";
    url: string;
    thumbnail: string;
};

export type CatalogItem = {
    /** מזהה המסמך ומזהה המוצר בחנויות; מפתח הבעלות באפליקציה */
    storeId: string;
    kind: Kind;
    /** סדר תצוגה, 0 ראשון */
    order: number;
    title: Localized;
    author: Localized;
    description: Localized;
    /** תווית נוסח לתצוגה בלבד */
    nusach: Localized;
    /** '' = לכל הנוסחים */
    nusachId: string;
    contentId: string;
    backgroundColor: string;
    thumbnail: string;
    /** הכנה לתפילה בלבד */
    preparationContent: Track[];
};

export const EMPTY_LOCALIZED: Localized = { default: "", he: "" };

export function emptyItem(order: number): CatalogItem {
    return {
        storeId: "",
        kind: "translation",
        order,
        title: { ...EMPTY_LOCALIZED },
        author: { ...EMPTY_LOCALIZED },
        description: { ...EMPTY_LOCALIZED },
        nusach: { ...EMPTY_LOCALIZED },
        nusachId: "",
        contentId: "",
        backgroundColor: "",
        thumbnail: "",
        preparationContent: [],
    };
}

export function emptyTrack(): Track {
    return { id: "", rank: "", title: { ...EMPTY_LOCALIZED }, type: "audio", url: "", thumbnail: "" };
}
