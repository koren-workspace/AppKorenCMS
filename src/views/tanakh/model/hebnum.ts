/**
 * מספרים בעברית (גימטריה) לתצוגת הפניות: 1 → "א", 15 → "טו", 18 → "יח", 100 → "ק".
 * ההפך של gematria() ב-tanakhBooks.ts.
 */

import { tanakhBook } from "./tanakhBooks";
import type { VerseRef } from "./types";

const ONES = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת", "תק", "תר", "תש", "תת", "תתק"];

export function toHebrewNumeral(n: number): string {
    if (!Number.isInteger(n) || n < 1 || n > 999) return String(n);
    let rest = n;
    let out = HUNDREDS[Math.floor(rest / 100)];
    rest %= 100;
    // טו / טז במקום יה / יו
    if (rest === 15) return out + "טו";
    if (rest === 16) return out + "טז";
    out += TENS[Math.floor(rest / 10)] + ONES[rest % 10];
    return out;
}

/** "יהושע יח, א" / "שיר השירים ד, יב–יד"; ספר לא מוכר → המזהה */
export function formatVerseRef(ref: VerseRef): string {
    const book = tanakhBook(ref.book)?.he ?? ref.book;
    const verse = ref.v2 ? `${toHebrewNumeral(ref.v)}–${toHebrewNumeral(ref.v2)}` : toHebrewNumeral(ref.v);
    return `${book} ${toHebrewNumeral(ref.ch)}, ${verse}`;
}
