/**
 * GlobalSearchModal – "חיפוש מורחב": חיפוש טקסט בפריטים בכל הקטגוריות והתפילות,
 * ולפי בחירה גם בכל התרגומים ובכל הנוסחים.
 *
 * לחיצה על תוצאה מנווטת למקטע ומסמנת את הפריט (onOpenHit). המודל לא מתפרק
 * בסגירה – התוצאות נשמרות, כך שאפשר לחזור לרשימה ולעבור לתוצאה הבאה.
 * הטעינה מהשרת והמטמון – ב-globalSearchService.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Entity } from "@firecms/core";
import {
    buildSearchTargets,
    clearGlobalSearchCache,
    listScopeOptions,
    translationKind,
    countUncachedTargets,
    loadTargets,
    searchLoaded,
    type CachedItem,
    type GlobalSearchScope,
    type SearchHit,
} from "../services/globalSearchService";

const PAGE_SIZE = 200;

const FIELD_LABELS: Record<SearchHit["field"], string> = {
    content: "",
    title: "כותרת",
    reference: "מקורות",
    itemId: "מזהה פריט",
};

type GlobalSearchModalProps = {
    open: boolean;
    onClose: () => void;
    tocItems: Entity<any>[];
    currentTocId: string | null;
    currentTranslationId: string | null;
    onOpenHit: (hit: SearchHit, query: string) => void;
};

export function GlobalSearchModal({
    open,
    onClose,
    tocItems,
    currentTocId,
    currentTranslationId,
    onOpenHit,
}: GlobalSearchModalProps) {
    const [query, setQuery] = useState("");
    // "" = הכל. ברירת המחדל נקבעת בפתיחה הראשונה לפי הבחירה במסך (ראו למטה)
    const [tocChoice, setTocChoice] = useState("");
    const [kindChoice, setKindChoice] = useState("0");
    const [loaded, setLoaded] = useState<Map<string, CachedItem[]> | null>(null);
    const [loadedScopeKey, setLoadedScopeKey] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [lastOpenedDocId, setLastOpenedDocId] = useState<string | null>(null);
    const loadGenRef = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const scopeOptions = useMemo(() => listScopeOptions(tocItems), [tocItems]);

    // בפתיחה הראשונה – הטווח מתחיל מהנוסח והתרגום שנבחרו במסך (אם נבחרו).
    // בפתיחות הבאות הבחירה נשמרת, כדי לא לאבד את התוצאות.
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!open || initializedRef.current) return;
        initializedRef.current = true;
        if (currentTocId) setTocChoice(currentTocId);
        if (currentTranslationId) setKindChoice(translationKind(currentTranslationId));
    }, [open, currentTocId, currentTranslationId]);

    const scope: GlobalSearchScope = {
        tocId: tocChoice || null,
        translationKind: kindChoice || null,
    };
    const scopeKey = `${tocChoice}|${kindChoice}`;

    const targets = useMemo(
        () => buildSearchTargets(tocItems, scope),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tocItems, scopeKey]
    );

    const isLoading = progress != null && progress.done < progress.total;
    const isLoadedForScope = loaded != null && loadedScopeKey === scopeKey;

    const hits = useMemo(
        () => (isLoadedForScope && loaded ? searchLoaded(targets, loaded, query) : []),
        [isLoadedForScope, loaded, targets, query]
    );

    useEffect(() => setVisibleCount(PAGE_SIZE), [query, scopeKey]);

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 0);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const runSearch = async () => {
        if (!query.trim() || isLoading) return;
        if (isLoadedForScope) return; // החיפוש עצמו רץ בזיכרון בכל הקלדה
        const gen = ++loadGenRef.current;
        setError(null);
        try {
            const map = await loadTargets(
                targets,
                (done, total) => {
                    if (gen === loadGenRef.current) setProgress({ done, total });
                },
                () => gen !== loadGenRef.current
            );
            if (gen !== loadGenRef.current) return;
            setLoaded(map);
            setLoadedScopeKey(scopeKey);
        } catch (err) {
            console.error("[GlobalSearch] load failed", err);
            if (gen === loadGenRef.current) setError("שגיאה בטעינת הפריטים. נסו שוב.");
        } finally {
            if (gen === loadGenRef.current) setProgress(null);
        }
    };

    const refresh = () => {
        loadGenRef.current++;
        clearGlobalSearchCache();
        setLoaded(null);
        setLoadedScopeKey(null);
        setProgress(null);
    };

    // אחרי רענון / שינוי טווח – אם יש שאילתה, לטעון מחדש אוטומטית
    useEffect(() => {
        if (open && query.trim() && !isLoadedForScope && !isLoading && loaded == null) {
            void runSearch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    // שינוי טווח אחרי שכבר חיפשו – מחפשים מחדש מיד בטווח החדש
    useEffect(() => {
        if (open && loaded != null && !isLoadedForScope && query.trim()) void runSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeKey]);

    const countsByNusach = useMemo(() => {
        const counts = new Map<string, number>();
        hits.forEach((h) => counts.set(h.nusachLabel, (counts.get(h.nusachLabel) ?? 0) + 1));
        return [...counts.entries()];
    }, [hits]);

    const uncached = countUncachedTargets(targets);

    if (!open) return null;

    const selectClass =
        "border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50";

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
            <div
                className="bg-white rounded-lg shadow-xl w-[min(960px,96vw)] h-[88vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 shrink-0">
                    <h2 className="font-bold text-lg">חיפוש מורחב</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 text-lg"
                        aria-label="סגור"
                    >
                        ✕
                    </button>
                </div>

                <div className="p-4 border-b space-y-3 shrink-0">
                    <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                            e.preventDefault();
                            void runSearch();
                        }}
                    >
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="search"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="טקסט לחיפוש (ללא צורך בניקוד), כותרת, מקור או מזהה פריט"
                                className="w-full pr-8 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                                dir="rtl"
                                aria-label="טקסט לחיפוש מורחב"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none select-none">
                                🔍
                            </span>
                        </div>
                        <button
                            type="submit"
                            disabled={!query.trim() || isLoading || isLoadedForScope}
                            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
                        >
                            חפש
                        </button>
                    </form>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                        <label className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">נוסח:</span>
                            <select
                                value={tocChoice}
                                onChange={(e) => setTocChoice(e.target.value)}
                                disabled={isLoading}
                                className={selectClass}
                            >
                                <option value="">כל הנוסחים</option>
                                {scopeOptions.nusachim.map((n) => (
                                    <option key={n.id} value={n.id}>
                                        {n.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex items-center gap-2">
                            <span className="font-semibold text-gray-700">תרגום:</span>
                            <select
                                value={kindChoice}
                                onChange={(e) => setKindChoice(e.target.value)}
                                disabled={isLoading}
                                className={selectClass}
                            >
                                <option value="">כל התרגומים</option>
                                {scopeOptions.translationKinds.map((t) => (
                                    <option key={t.kind} value={t.kind}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span>החיפוש כולל את כל הקטגוריות והתפילות ({targets.length} תפילות בטווח).</span>
                        {!isLoadedForScope && uncached > 0 && !isLoading && (
                            <span>בחיפוש הראשון ייטענו {uncached} תפילות מהשרת; חיפושים נוספים מיידיים.</span>
                        )}
                        {isLoadedForScope && (
                            <button type="button" onClick={refresh} className="text-blue-600 hover:underline" disabled={isLoading}>
                                ↻ רענון נתונים
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4">
                    {error && <div className="text-red-600 text-sm mb-2">{error}</div>}

                    {isLoading && progress && (
                        <div className="space-y-2" role="status" aria-live="polite">
                            <div className="text-sm text-blue-700">
                                טוען פריטים… {progress.done} / {progress.total} תפילות
                            </div>
                            <div className="h-2 bg-gray-200 rounded">
                                <div
                                    className="h-2 bg-blue-500 rounded transition-all"
                                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {!isLoading && !isLoadedForScope && !error && (
                        <div className="text-sm text-gray-500">הקלידו טקסט ולחצו "חפש" (או Enter).</div>
                    )}

                    {!isLoading && isLoadedForScope && query.trim() !== "" && (
                        <>
                            <div className="text-sm text-gray-700 mb-3">
                                {hits.length === 0 ? (
                                    <span className="text-red-500">לא נמצאו פריטים.</span>
                                ) : (
                                    <>
                                        נמצאו <span className="font-bold">{hits.length}</span> פריטים
                                        {countsByNusach.length > 1 && (
                                            <span className="text-gray-500">
                                                {" "}
                                                ({countsByNusach.map(([label, n]) => `${label} ${n}`).join(" · ")})
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            <ul className="space-y-1.5">
                                {hits.slice(0, visibleCount).map((hit) => (
                                    <li key={`${hit.translationId}/${hit.prayerId}/${hit.docId}`}>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setLastOpenedDocId(hit.docId);
                                                onOpenHit(hit, query);
                                            }}
                                            className={`w-full text-right border rounded p-2 hover:border-blue-300 hover:bg-blue-50/50 ${
                                                lastOpenedDocId === hit.docId
                                                    ? "border-blue-400 bg-blue-50"
                                                    : "border-gray-200"
                                            }`}
                                        >
                                            <div className="text-xs text-gray-500 flex flex-wrap gap-x-1">
                                                <span className="font-semibold text-gray-700">{hit.nusachLabel}</span>
                                                <span>›</span>
                                                <span>{hit.translationLabel}</span>
                                                <span>›</span>
                                                <span>{hit.categoryName}</span>
                                                <span>›</span>
                                                <span>{hit.prayerName}</span>
                                                <span>›</span>
                                                <span className="font-semibold text-gray-700">{hit.partName}</span>
                                                <span className="text-gray-400 mr-2 tabular-nums">#{hit.itemId}</span>
                                                {FIELD_LABELS[hit.field] && (
                                                    <span className="text-violet-600 mr-1">({FIELD_LABELS[hit.field]})</span>
                                                )}
                                            </div>
                                            <div className="text-sm mt-1 leading-relaxed">
                                                {hit.before}
                                                {hit.match && <mark className="bg-yellow-200 rounded-sm">{hit.match}</mark>}
                                                {hit.after}
                                            </div>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            {hits.length > visibleCount && (
                                <button
                                    type="button"
                                    onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                                    className="mt-3 text-sm text-blue-600 hover:underline"
                                >
                                    הצג עוד ({hits.length - visibleCount} נוספים)
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
