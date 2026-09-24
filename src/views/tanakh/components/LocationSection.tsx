/**
 * LocationSection – נקודת הציון של הערך: מפה, שדות קואורדינטות, רמת ביטחון
 * והדבקה מ-Google Maps.
 */

import React, { useMemo, useState } from "react";
import type { Entry, EntryLocation } from "../model/types";
import type { ValidationIssue } from "../model/validate";
import { parseCoordinates, roundCoord } from "../utils/tiles";
import { MapPicker, type MapMarker } from "./MapPicker";
import { ts } from "./tanakhStyles";

/** רמות הביטחון כפי שהן בתוכן הקיים */
export const CONF_LABELS: Record<1 | 2 | 3, string> = {
    1: "1 – מזוהה בוודאות",
    2: "2 – זיהוי סביר",
    3: "3 – זיהוי משוער",
};

export interface LocationSectionProps {
    draft: Entry;
    /** שאר הערכים – להצגת נקודות שכנות על המפה */
    allEntries: readonly Entry[];
    onChange: (location: EntryLocation | undefined) => void;
    issues: ValidationIssue[];
    disabled?: boolean;
}

/** כמה נקודות שכנות להציג ברקע */
const CONTEXT_LIMIT = 400;

export function LocationSection({ draft, allEntries, onChange, issues, disabled }: LocationSectionProps) {
    const [paste, setPaste] = useState("");
    const [pasteError, setPasteError] = useState(false);
    const loc = draft.location;

    const context: MapMarker[] = useMemo(
        () =>
            allEntries
                .filter(e => e.location && e.id !== draft.id)
                .slice(0, CONTEXT_LIMIT)
                .map(e => ({ lat: e.location!.lat, lng: e.location!.lng, title: e.title.he })),
        [allEntries, draft.id],
    );

    function setPart(patch: Partial<EntryLocation>) {
        const base: EntryLocation = loc ?? { lat: 0, lng: 0, conf: 2 };
        onChange({ ...base, ...patch });
    }

    function applyPaste() {
        const p = parseCoordinates(paste);
        if (!p) {
            setPasteError(true);
            return;
        }
        setPasteError(false);
        setPaste("");
        onChange({ lat: p.lat, lng: p.lng, conf: loc?.conf ?? 2 });
    }

    return (
        <section style={ts.section}>
            <div style={{ ...ts.row, justifyContent: "space-between" }}>
                <h4 style={ts.sectionTitle}>מיקום</h4>
                {loc && (
                    <button style={ts.smallBtn} disabled={disabled} onClick={() => onChange(undefined)}>
                        הסרת המיקום
                    </button>
                )}
            </div>
            <p style={ts.hint}>
                נקודת הציון שמוצגת באפליקציה ובמפה. ערך בלי מיקום (צמח, בעל חיים, מונח) פשוט לא מופיע על המפה.
                הנקודות הכחולות הן ערכים אחרים, להתמצאות.
            </p>

            <div style={{ ...ts.row, alignItems: "flex-end" }}>
                <CoordInput
                    id="tlm-lat"
                    label="קו רוחב (lat)"
                    value={loc?.lat}
                    disabled={disabled}
                    onCommit={n => setPart({ lat: n })}
                />
                <CoordInput
                    id="tlm-lng"
                    label="קו אורך (lng)"
                    value={loc?.lng}
                    disabled={disabled}
                    onCommit={n => setPart({ lng: n })}
                />

                <label style={{ ...ts.label, minWidth: 180 }}>
                    רמת ודאות הזיהוי
                    <select
                        id="tlm-conf"
                        style={ts.select}
                        value={loc?.conf ?? 2}
                        disabled={disabled || !loc}
                        onChange={e => setPart({ conf: Number(e.target.value) as 1 | 2 | 3 })}
                    >
                        {([1, 2, 3] as const).map(c => (
                            <option key={c} value={c}>{CONF_LABELS[c]}</option>
                        ))}
                    </select>
                </label>
            </div>

            <div style={ts.row}>
                <input
                    id="tlm-coord-paste"
                    style={{ ...ts.input, flex: 1, ...ts.inputLtr, borderColor: pasteError ? "#b71c1c" : undefined }}
                    placeholder="הדבקת קואורדינטות או כתובת מ-Google Maps"
                    value={paste}
                    disabled={disabled}
                    onChange={e => { setPaste(e.target.value); setPasteError(false); }}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); applyPaste(); } }}
                />
                <button style={ts.secondaryBtn} onClick={applyPaste} disabled={disabled || !paste.trim()}>קביעה מההדבקה</button>
            </div>
            {pasteError && <p style={ts.fieldError}>לא זוהו קואורדינטות. דוגמאות: 31.705, 35.202 או כתובת של Google Maps.</p>}

            <MapPicker
                lat={loc?.lat}
                lng={loc?.lng}
                context={context}
                disabled={disabled}
                onPick={(la, ln) => onChange({ lat: la, lng: ln, conf: loc?.conf ?? 2 })}
            />

            {issues.map((i, k) => (
                <p key={k} style={i.level === "error" ? ts.fieldError : ts.fieldWarn}>{i.message}</p>
            ))}
        </section>
    );
}

/**
 * שדה קואורדינטה. הטקסט נשמר מקומית בזמן ההקלדה, כדי ש"31." או סימן מינוס
 * בודד לא יימחקו באמצע; הערך נמסר למעלה רק כשהוא מספר שלם ותקין.
 */
function CoordInput({ id, label, value, disabled, onCommit }: { id: string; label: string; value?: number; disabled?: boolean; onCommit: (n: number) => void }) {
    const [text, setText] = useState<string | null>(null);
    const shown = text ?? (value === undefined ? "" : String(value));
    const bad = text !== null && text.trim() !== "" && !Number.isFinite(Number(text));
    return (
        <label style={{ ...ts.label, width: 130 }}>
            {label}
            <input
                id={id}
                style={{ ...ts.input, ...ts.inputLtr, borderColor: bad ? "#b71c1c" : undefined }}
                inputMode="decimal"
                value={shown}
                disabled={disabled}
                onChange={e => {
                    setText(e.target.value);
                    const n = Number(e.target.value);
                    if (e.target.value.trim() !== "" && Number.isFinite(n)) onCommit(roundCoord(n));
                }}
                onBlur={() => setText(null)}
            />
        </label>
    );
}
