/**
 * entriesService – קריאה וכתיבה של ערכים וקטגוריות בפרויקט התנ"ך.
 *
 * כל הערכים נטענים בבת אחת (כ-3MB ל-835 ערכים) ומסוננים בדפדפן – כך החיפוש
 * מיידי. הכתיבה היא setDoc של המסמך השלם, אחרי prepareEntryForSave.
 */

import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import { getTanakhFirestore } from "./tanakhAuthService";
import { CATEGORIES_COLLECTION, ENTRIES_COLLECTION, type Category, type Entry } from "../model/types";
import { prepareEntryForSave, stripUndefined } from "../model/entryOps";
import { LEGACY_CATEGORIES } from "../model/categories";
import { appendChangeLog } from "../../toc-translations/services/changeLogService";

export interface TanakhContent {
    entries: Entry[];
    categories: Category[];
    /** false = קולקציית הקטגוריות ריקה והוצגו הקטגוריות המובנות (לפני ההעברה) */
    categoriesFromDb: boolean;
}

/** משלים שדות שאולי חסרים במסמכים ישנים, כדי שהטופס לא ייפול */
function normalizeEntry(id: string, raw: Record<string, unknown>): Entry {
    const e = raw as Partial<Entry>;
    return {
        id,
        cat: e.cat ?? "places",
        title: e.title ?? { he: "" },
        altTitles: e.altTitles ?? { he: [] },
        body: e.body ?? { he: "" },
        quotes: e.quotes ?? [],
        refs: e.refs ?? [],
        xrefs: e.xrefs ?? [],
        see: e.see,
        region: e.region,
        page: e.page,
        location: e.location,
        images: e.images ?? [],
        anchors: e.anchors ?? [],
        visible: e.visible ?? true,
        notes: e.notes,
        i18n: e.i18n ?? {},
        review: e.review ?? [],
        createdAt: e.createdAt ?? 0,
        updatedAt: e.updatedAt ?? 0,
        updatedBy: e.updatedBy,
    };
}

export async function loadContent(): Promise<TanakhContent> {
    const db = getTanakhFirestore();
    const [entriesSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, ENTRIES_COLLECTION)),
        getDocs(collection(db, CATEGORIES_COLLECTION)),
    ]);
    const entries = entriesSnap.docs.map(d => normalizeEntry(d.id, d.data()));
    // מסד ריק (לפני ההעברה): הקטגוריות המובנות, כדי שאפשר יהיה ליצור ערך ראשון
    const categories = categoriesSnap.empty
        ? [...LEGACY_CATEGORIES]
        : categoriesSnap.docs.map(d => ({ ...(d.data() as Category), key: d.id }));
    categories.sort((a, b) => a.order - b.order);
    return { entries, categories, categoriesFromDb: !categoriesSnap.empty };
}

export async function saveEntry(entry: Entry, user: string | undefined, isNew: boolean): Promise<Entry> {
    const prepared = prepareEntryForSave(entry, user);
    await setDoc(doc(getTanakhFirestore(), ENTRIES_COLLECTION, prepared.id), stripUndefined(prepared));
    appendChangeLog({
        timestamp: prepared.updatedAt,
        action: "save_tanakh_entry",
        context: { categoryId: prepared.cat },
        details: { tanakh: { entryId: prepared.id, title: prepared.title.he, summary: `${isNew ? "נוצר" : "נשמר"} ערך ${prepared.id} "${prepared.title.he}"` } },
        savedToFirestore: true,
    });
    return prepared;
}

export async function deleteEntry(entry: Entry): Promise<void> {
    await deleteDoc(doc(getTanakhFirestore(), ENTRIES_COLLECTION, entry.id));
    appendChangeLog({
        timestamp: Date.now(),
        action: "delete_tanakh_entry",
        context: { categoryId: entry.cat },
        details: { tanakh: { entryId: entry.id, title: entry.title.he, summary: `נמחק ערך ${entry.id} "${entry.title.he}"` } },
        savedToFirestore: true,
    });
}

export async function saveCategory(category: Category): Promise<void> {
    await setDoc(doc(getTanakhFirestore(), CATEGORIES_COLLECTION, category.key), stripUndefined(category));
    appendChangeLog({
        timestamp: Date.now(),
        action: "save_tanakh_category",
        context: { categoryId: category.key, categoryName: category.name.he },
        details: { tanakh: { categoryKey: category.key, title: category.name.he, summary: `נשמרה קטגוריה ${category.key} "${category.name.he}"` } },
        savedToFirestore: true,
    });
}

/** זריעת הקטגוריות המובנות כשהקולקציה ריקה (יצירת ערך ראשון לפני ההעברה) */
export async function seedCategories(): Promise<void> {
    await Promise.all(LEGACY_CATEGORIES.map(c => setDoc(doc(getTanakhFirestore(), CATEGORIES_COLLECTION, c.key), stripUndefined(c))));
}
