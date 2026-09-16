/**
 * StatusIcons – סמלי המצב בשורות רשימת הערכים.
 *
 * SVG מוטבע ולא אמוג'י: אמוג'י נראה שונה בכל מערכת הפעלה (ובחלקן מתרנדר
 * כריבוע), ו-👁 בפרט נקרא כ"הצגה" ולא כ"מוסתר". לכל סמל יש גם title, כך
 * שהריחוף מסביר אותו.
 */

import React from "react";
import { AMBER, GREEN } from "./tanakhStyles";

const SIZE = 14;

function Svg({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
    return (
        <svg
            width={SIZE}
            height={SIZE}
            viewBox="0 0 24 24"
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label={title}
            style={{ flexShrink: 0 }}
        >
            <title>{title}</title>
            {children}
        </svg>
    );
}

/** ערך מוסתר מהאפליקציה – עין חצויה */
export function HiddenIcon() {
    return (
        <Svg title="מוסתר – לא ייכנס לקובץ התוכן בפרסום" color="#9e9e9e">
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.15 18.15 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
            <line x1="2" y1="2" x2="22" y2="22" />
        </Svg>
    );
}

/** לערך יש מיקום על המפה */
export function LocationIcon({ title = "יש מיקום" }: { title?: string }) {
    return (
        <Svg title={title} color={GREEN}>
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
            <circle cx="12" cy="10" r="3" />
        </Svg>
    );
}

/** לערך יש תמונות */
export function ImagesIcon({ count }: { count: number }) {
    return (
        <Svg title={`${count} תמונות`} color="#607d8b">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
        </Svg>
    );
}

/** לערך יש הערות לבדיקה */
export function ReviewIcon({ count }: { count: number }) {
    return (
        <Svg title={`לבדיקה (${count})`} color={AMBER}>
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="7.5" x2="12" y2="13" />
            <line x1="12" y1="16.5" x2="12" y2="16.6" />
        </Svg>
    );
}

/** לערך יש קישורים מהפסוקים */
export function AnchorsIcon({ count }: { count: number }) {
    return (
        <Svg title={`${count} קישורים מהפסוקים`} color="#7e57c2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </Svg>
    );
}
