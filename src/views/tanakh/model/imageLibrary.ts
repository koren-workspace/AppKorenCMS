/**
 * מאגר התמונות שכבר קיימות במערכת, לבורר "צירוף תמונה קיימת".
 *
 * התמונות הארוזות הגיעו מסריקת הספר, ובספר ערך הפניה ("ראה X") יושב באותו
 * עמוד עם הערך המלא – כך נתלו כמה תמונות על ההפניה במקום על הערך שמתחתיה.
 * לתקן דורש להעביר תמונה מערך לערך, ולכן צריך למצוא אותה קודם.
 *
 * החיפוש רץ על הכיתוב, על שם הערך שמחזיק את התמונה ועל מזהה הקובץ – בסדר
 * הזה מבחינת חשיבות. מי שמחפש את התמונה של "עש הבגדים" יודע מה כתוב
 * מתחתיה, לא איך קוראים לקובץ.
 */

import type { Entry, EntryImage } from "./types";

/** תמונה שכבר יושבת על ערך כלשהו, עם הערך שמחזיק אותה */
export interface LibraryImage {
    img: EntryImage;
    entryId: string;
    entryTitle: string;
}

/** קצר מזה מתאים כמעט לכל תמונה ורק מציף את הרשימה */
export const MIN_QUERY = 2;

/** מעבר לזה הרשימה כבר לא נסרקת בהצצה */
export const MAX_RESULTS = 12;

export function buildImageLibrary(entries: readonly Entry[]): LibraryImage[] {
    return entries.flatMap(e =>
        (e.images ?? []).map(img => ({ img, entryId: e.id, entryTitle: e.title?.he ?? e.id })),
    );
}

/**
 * התמונות שמתאימות לחיפוש, בלי כאלה שכבר על הערך הזה.
 *
 * תמונה אחת יכולה לשבת על כמה ערכים; היא מוצגת פעם אחת, עם הערך הראשון
 * שמחזיק אותה – אחרת אותה תמונה חוזרת ברשימה ונראית כמו כמה תמונות שונות.
 */
export function findImages(
    library: readonly LibraryImage[],
    query: string,
    current: readonly EntryImage[] = [],
): LibraryImage[] {
    const needle = query.trim().toLowerCase();
    if (needle.length < MIN_QUERY) return [];
    const here = new Set(current.map(i => i.src));
    const seen = new Set<string>();
    const out: LibraryImage[] = [];
    for (const row of library) {
        if (here.has(row.img.src) || seen.has(row.img.src)) continue;
        const hay = [row.img.caption?.he ?? "", row.img.caption?.en ?? "", row.entryTitle, row.img.src]
            .join(" ")
            .toLowerCase();
        if (!hay.includes(needle)) continue;
        seen.add(row.img.src);
        out.push(row);
        if (out.length >= MAX_RESULTS) break;
    }
    return out;
}
