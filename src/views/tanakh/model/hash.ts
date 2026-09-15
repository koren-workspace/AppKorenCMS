/**
 * hash יציב וקצר לטקסט – לזיהוי "התרגום לא מעודכן" (stale):
 * בזמן התרגום שומרים את ה-hash של שדות המקור; אם ה-hash הנוכחי שונה,
 * העברית השתנתה מאז. FNV-1a 32-bit, סינכרוני, בלי תלות ב-crypto.
 */

export function fnv1a(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

const FIELD_SEP = "";
const ITEM_SEP = "";

/** ה-hash של כל שדות המקור (עברית) שמשפיעים על תרגום */
export function sourceHashOf(entry: {
    title: { he: string };
    altTitles: { he: string[] };
    body: { he: string };
    region?: { he: string };
    images: { caption?: { he: string } }[];
}): string {
    const parts = [
        entry.title.he,
        entry.altTitles.he.join(ITEM_SEP),
        entry.body.he,
        entry.region?.he ?? "",
        entry.images.map(i => i.caption?.he ?? "").join(ITEM_SEP),
    ];
    return fnv1a(parts.join(FIELD_SEP));
}
