/**
 * TanakhEditorHarness – סביבת העבודה של התנ"ך למטייל עם נתוני דוגמה בזיכרון,
 * בלי Firebase. לבדיקות Playwright ולצילומי מסך. נפתח ב-?playwright=tanakh-editor
 */

import React, { useMemo, useState } from "react";
import { EntryList } from "../views/tanakh/components/EntryList";
import { EntryEditor } from "../views/tanakh/components/EntryEditor";
import { CategoriesModal } from "../views/tanakh/components/CategoriesModal";
import { ts } from "../views/tanakh/components/tanakhStyles";
import { LEGACY_CATEGORIES } from "../views/tanakh/model/categories";
import { emptyEntry, type Category, type Entry } from "../views/tanakh/model/types";
import { entriesEqual, nextEntryId, prepareEntryForSave, setTranslationStatus } from "../views/tanakh/model/entryOps";
import { validateEntry } from "../views/tanakh/model/validate";

function sample(): Entry[] {
    const shiloh = emptyEntry("e0203", "places", 1700000000000);
    shiloh.title = { he: "שִׁילֹה", en: "Shiloh" };
    shiloh.altTitles = { he: ["שילו"], en: ["Shilo"] };
    shiloh.body = {
        he: "שילה הייתה מרכזו הרוחני של עם ישראל במשך כשלוש מאות שנה. כאן עמד המשכן מימי יהושע ועד ימי עלי הכהן.\n\n## המשכן בשילה\n\nאל המקום הזה עלתה חנה להתפלל, וכאן גדל שמואל הנביא.\n\n~ בתל נחשפו שרידים מתקופת ההתנחלות, ובהם מחסני קנקנים ומזבח.",
        en: "Shiloh was the spiritual center of Israel for some three hundred years.",
    };
    shiloh.quotes = [{ book: "yehoshua", ch: 18, v: 1 }, { book: "shmuel-a", ch: 1, v: 3 }];
    shiloh.refs = [{ raw: "יהושע יח, א", book: "yehoshua", ch: 18, v: 1 }, { raw: "שמואל א א–ד", book: "shmuel-a", ch: 1 }, { raw: "תצפית מהתל אל ההר" }];
    shiloh.xrefs = ["e0300", "e0250"];
    shiloh.region = { he: "השומרון" };
    shiloh.page = 300;
    shiloh.location = { lat: 32.0556, lng: 35.2897, conf: 1 };
    shiloh.images = [{ kind: "baked", src: "e0203_1_1", caption: { he: "התל" } }];
    shiloh.anchors = [
        { book: "yehoshua", ch: 18, v: 1, w: "שלה" },
        { book: "shmuel-a", ch: 1, v: 3 },
        { book: "shoftim", ch: 21, v: 19 },
    ];
    shiloh.review = ['ערך קשור לא נמצא: "משכן"', 'ציטוט לא זוהה כפסוק: "מקום המשכן"'];
    shiloh.i18n.en = { status: "stale", updatedAt: 1700000000000, updatedBy: "translator@korenpub.com" };
    shiloh.updatedAt = 1700000000000;
    shiloh.updatedBy = "malka@korenpub.com";
    shiloh.visible = true;

    const jerusalem = emptyEntry("e0300", "places", 1);
    jerusalem.title = { he: "יְרוּשָׁלַיִם", en: "Jerusalem" };
    jerusalem.body = { he: "עיר הבירה." };
    jerusalem.visible = true;
    jerusalem.location = { lat: 31.77, lng: 35.23, conf: 1 };

    const beitEl = emptyEntry("e0250", "places", 1);
    beitEl.title = { he: "בֵּית אֵל" };
    beitEl.body = { he: "עיר בהר אפרים." };
    beitEl.visible = false;

    const luz = emptyEntry("e0251", "places", 1);
    luz.title = { he: "לוּז" };
    luz.see = "e0250";
    luz.visible = true;

    const olive = emptyEntry("e0080", "plants", 1);
    olive.title = { he: "זַיִת" };
    olive.body = { he: "עץ הזית הוא אחד משבעת המינים." };
    olive.visible = true;

    return [shiloh, jerusalem, beitEl, luz, olive];
}

export function TanakhEditorHarness() {
    const [entries, setEntries] = useState<Entry[]>(sample);
    const [selectedId, setSelectedId] = useState<string | null>("e0203");
    const [draft, setDraft] = useState<Entry | null>(() => structuredClone(sample()[0]));
    const [isNew, setIsNew] = useState(false);
    const [saved, setSaved] = useState<string[]>([]);
    const [notice, setNotice] = useState<string | null>(null);
    const [catsOpen, setCatsOpen] = useState(false);
    const [cats, setCats] = useState<Category[]>(() => [...LEGACY_CATEGORIES]);
    const categories = cats;

    const original = useMemo(() => entries.find(e => e.id === selectedId) ?? null, [entries, selectedId]);
    const dirty = Boolean(draft && (isNew || (original && !entriesEqual(draft, original))));
    const issues = useMemo(() => (draft ? validateEntry(draft, { entryIds: new Set(entries.map(e => e.id)), categoryKeys: new Set(categories.map(c => c.key)) }) : []), [draft, entries, categories]);

    function select(id: string) {
        const e = entries.find(x => x.id === id);
        if (!e) return;
        setSelectedId(id);
        setDraft(structuredClone(e));
        setIsNew(false);
    }
    function save(next: Entry) {
        const prepared = prepareEntryForSave(next, "harness@test", Date.now());
        setEntries(es => [...es.filter(e => e.id !== prepared.id), prepared]);
        setDraft(structuredClone(prepared));
        setIsNew(false);
        setSaved(s => [...s, prepared.id]);
    }

    return (
        <div style={ts.page} data-testid="tanakh-harness">
            <div style={ts.header}><h2 style={ts.title}>התנ"ך למטייל – סביבת בדיקה</h2><span style={ts.muted} data-testid="saved-count">נשמרו: {saved.length}</span></div>
            {notice && <div style={{ ...ts.banner, ...ts.bannerInfo }} data-testid="notice">{notice}</div>}
            <div style={ts.workspace}>
                <EntryList
                    entries={entries}
                    categories={categories}
                    selectedId={selectedId}
                    dirtyId={dirty ? selectedId : null}
                    onSelect={select}
                    onNew={() => { const id = nextEntryId(entries.map(e => e.id)); setSelectedId(id); setDraft(emptyEntry(id, "places")); setIsNew(true); }}
                    onReload={() => undefined}
                    onManageCategories={() => setCatsOpen(true)}
                />
                {draft && (
                    <EntryEditor
                        draft={draft}
                        isNew={isNew}
                        dirty={dirty}
                        busy={false}
                        categories={categories}
                        allEntries={entries}
                        issues={issues}
                        onChange={setDraft}
                        onSave={() => save(draft)}
                        onDelete={() => { setEntries(es => es.filter(e => e.id !== draft.id)); setDraft(null); setSelectedId(null); }}
                        onRevert={() => original && setDraft(structuredClone(original))}
                        onMarkTranslation={s => save(setTranslationStatus(draft, "en", s, "harness@test"))}
                        onNotice={(kind, text) => setNotice(`${kind}: ${text}`)}
                    />
                )}
            </div>
            <CategoriesModal
                open={catsOpen}
                categories={categories}
                entries={entries}
                onSave={c => setCats(list => [...list.filter(x => x.key !== c.key), c].sort((a, b) => a.order - b.order))}
                onClose={() => setCatsOpen(false)}
            />
        </div>
    );
}
