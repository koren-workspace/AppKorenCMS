/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import federation from "@originjs/vite-plugin-federation"
import path from "path"
import fs from "fs"
import { createRequire } from "module"
import type * as XLSXTypes from "xlsx"

// xlsx הוא מודול CJS – createRequire מבטיח טעינה תקינה גם בסביבת ESM
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = _require("xlsx") as typeof XLSXTypes

const CHANGELOG_ENDPOINT = "/__cms_changelog__"
const DOCS_CHANGELOG_PATH = path.resolve(process.cwd(), "docs", "cms-changelog.json")

// ─── Excel Audit Trail ────────────────────────────────────────────────────────
const EXCEL_ENDPOINT = "/__cms_excel__"
const EXCEL_PATH = path.resolve(process.cwd(), "docs", "cms-changes.xlsx")

/** שמות ה-sheets ב-Excel */
const SHEET_CHANGES = "שינויים"
const SHEET_SAVES = "שמירות"

/** עמודות מאפיינים לפריט – כל עמודה = ערך חדש של השדה אחרי השינוי */
const ITEM_FIELD_COLS = [
    "content", "type", "titleType", "title",
    "fontTanach", "noSpace", "block", "firstInPage", "specialDate",
    "cohanim", "hazan", "minyan",
    "role", "reference", "specialSign", "dateSetId",
]

/** כותרות עמודות לכל sheet */
const HEADERS_SAVES = [
    "save_id", "תאריך_ושעה", "פעולה",
    "tocId", "translationId", "prayerId", "partId",
    "מספר_שינויים", "סיכום",
    "נשמר_Firestore", "פורסם_Bagel",
]
const HEADERS_CHANGES = [
    "save_id", "תאריך_ושעה", "פעולה",
    "tocId", "translationId", "prayerId", "partId",
    "entityId", "itemId", "mitId",
    "enhancement", "enhancementTranslationId",
    ...ITEM_FIELD_COLS,
    "תיאור",
    "נשמר_Firestore", "פורסם_Bagel", "הצליח",
]

/** ממיר ISO timestamp לפורמט קריא בעברית (ישראל) */
function toIsraelTime(iso: string): string {
    try {
        return new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })
    } catch {
        return iso
    }
}

/** מחזיר V/X לפי הצלחת הפעולה */
function getHatzliach(entry: any): string {
    if (entry.action === "publish_to_bagel") {
        return entry.publishedToBagel === true ? "V" : entry.publishedToBagel === false ? "X" : ""
    }
    return entry.savedToFirestore === true ? "V" : entry.savedToFirestore === false ? "X" : ""
}

/** מחזיר מחרוזת סיכום קצרה לשמירה */
function buildSummary(entry: any): string {
    const d = entry.details ?? {}
    if (d.fieldChanges?.length) {
        const total: number = d.fieldChanges.reduce((s: number, fc: any) => s + (fc.changes?.length ?? 0), 0)
        return `${total} שינוי שדה`
    }
    if (d.deletedItemId) return `מחיקת פריט ${d.deletedItemId}`
    if (d.newItemId) return `הוספת תרגום לפריט ${d.baseItemId ?? d.newItemId}`
    if (d.newPartId) return `הוספת מקטע: ${d.partName ?? d.newPartId}`
    if (d.movedItemIds?.length) return `העברת ${d.movedItemIds.length} פריטים`
    if (d.newTocId) return `הוספת נוסח: ${d.nusachName ?? d.newTocId}`
    if (d.deletedId) return `מחיקת ${entry.action.replace("delete_", "")}: ${d.deletedName ?? d.deletedId}`
    return entry.action ?? ""
}

/**
 * מוסיף רשומת entry לקובץ Excel (פותח/יוצר → מוסיף שורות → שומר).
 * sheet "שמירות": שורה אחת לכל save event.
 * sheet "שינויים": שורה לכל שינוי שדה פרטני.
 */
function appendEntryToExcel(entry: any): void {
    // פתיחה / יצירה של קובץ
    let wb: XLSXTypes.WorkBook
    const dir = path.dirname(EXCEL_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    if (fs.existsSync(EXCEL_PATH)) {
        wb = XLSX.readFile(EXCEL_PATH)
    } else {
        wb = XLSX.utils.book_new()
    }

    // הבטח קיום sheet "שמירות"
    if (!wb.SheetNames.includes(SHEET_SAVES)) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS_SAVES]), SHEET_SAVES)
    }
    // הבטח קיום sheet "שינויים"
    if (!wb.SheetNames.includes(SHEET_CHANGES)) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([HEADERS_CHANGES]), SHEET_CHANGES)
    }

    const savesWs = wb.Sheets[SHEET_SAVES]
    const changesWs = wb.Sheets[SHEET_CHANGES]
    const ctx = entry.context ?? {}
    const d = entry.details ?? {}
    const dt = toIsraelTime(entry.timestampIso ?? new Date().toISOString())

    // ── שורה ב"שמירות" ──────────────────────────────────────────────────────
    const changesCount: number =
        d.fieldChanges?.reduce((s: number, fc: any) => s + (fc.changes?.length ?? 0), 0) ??
        (d.deletedItemId ? 1 : d.newItemId ? 1 : 0)

    XLSX.utils.sheet_add_aoa(savesWs, [[
        entry.id ?? "",
        dt,
        entry.action ?? "",
        ctx.tocId ?? "",
        ctx.translationId ?? "",
        ctx.prayerId ?? "",
        ctx.partId ?? "",
        changesCount,
        buildSummary(entry),
        entry.savedToFirestore != null ? (entry.savedToFirestore ? "כן" : "לא") : "",
        entry.publishedToBagel != null ? (entry.publishedToBagel ? "כן" : "לא") : "",
    ]], { origin: -1 })

    // ── שורות ב"שינויים" ────────────────────────────────────────────────────
    const changeRows: any[][] = []
    const firestoredStr = entry.savedToFirestore != null ? (entry.savedToFirestore ? "כן" : "לא") : ""
    const bagelStr = entry.publishedToBagel != null ? (entry.publishedToBagel ? "כן" : "לא") : ""
    const hatzliach = getHatzliach(entry)

    /** בסיס שורה: עמודות הקשר */
    function baseRow(): any[] {
        return [entry.id ?? "", dt, entry.action ?? "", ctx.tocId ?? "", ctx.translationId ?? "", ctx.prayerId ?? "", ctx.partId ?? ""]
    }

    /** שורת תיאור – לפעולות שאינן save_part_items (ללא עמודות שדות) */
    function makeDescRow(
        description: string,
        entityId = "", itemId = "", mitId = "", isEnh = "לא", enhTransId = ""
    ): any[] {
        return [
            ...baseRow(),
            entityId, itemId, mitId, isEnh, enhTransId,
            ...ITEM_FIELD_COLS.map(() => ""),
            description,
            firestoredStr, bagelStr, hatzliach,
        ]
    }

    // ── save_part_items: שורה אחת לפריט, עמודה לכל מאפיין ────────────────
    if (d.fieldChanges?.length) {
        for (const fc of d.fieldChanges) {
            const fieldMap: Record<string, string> = {}
            for (const c of fc.changes ?? []) {
                fieldMap[c.field] = c.newValue != null ? String(c.newValue) : ""
            }
            changeRows.push([
                ...baseRow(),
                fc.entityId ?? "", fc.itemId ?? "", fc.mitId ?? "",
                fc.isEnhancement ? "כן" : "לא",
                fc.enhancementTranslationId ?? "",
                ...ITEM_FIELD_COLS.map(f => fieldMap[f] ?? ""),
                "",
                firestoredStr, bagelStr, hatzliach,
            ])
        }
    }

    // ── delete_part_item ────────────────────────────────────────────────────
    if (d.deletedItemId) {
        changeRows.push(makeDescRow(
            `מחיקת פריט: itemId=${d.deletedItemId}`,
            d.deletedEntityId ?? "", d.deletedItemId
        ))
    }

    // ── create_translation_item ─────────────────────────────────────────────
    if (d.newItemId && entry.action === "create_translation_item") {
        changeRows.push(makeDescRow(
            `itemId: ${d.newItemId}`,
            "", d.newItemId, d.newMitId ?? "",
            "כן", d.targetTranslationId ?? ""
        ))
    }

    // ── add_part ─────────────────────────────────────────────────────────────
    if (entry.action === "add_part" && d.newPartId) {
        changeRows.push(makeDescRow(
            d.partName ? `${d.partName} (${d.newPartId})` : d.newPartId
        ))
    }

    // ── delete_part ──────────────────────────────────────────────────────────
    if (entry.action === "delete_part" && d.deletedId) {
        changeRows.push(makeDescRow(
            `מחיקה: ${d.deletedName ? `${d.deletedName} (${d.deletedId})` : d.deletedId}`
        ))
    }

    // ── add_prayer ───────────────────────────────────────────────────────────
    if (entry.action === "add_prayer" && d.newPrayerId) {
        changeRows.push(makeDescRow(
            d.prayerName ? `${d.prayerName} (${d.newPrayerId})` : d.newPrayerId
        ))
    }

    // ── delete_prayer ────────────────────────────────────────────────────────
    if (entry.action === "delete_prayer" && d.deletedId) {
        changeRows.push(makeDescRow(
            `מחיקה: ${d.deletedName ? `${d.deletedName} (${d.deletedId})` : d.deletedId}`
        ))
    }

    // ── add_category ─────────────────────────────────────────────────────────
    if (entry.action === "add_category" && d.newCategoryId) {
        changeRows.push(makeDescRow(
            d.categoryName ? `${d.categoryName} (${d.newCategoryId})` : d.newCategoryId
        ))
    }

    // ── delete_category ──────────────────────────────────────────────────────
    if (entry.action === "delete_category" && d.deletedId) {
        changeRows.push(makeDescRow(
            `מחיקה: ${d.deletedName ? `${d.deletedName} (${d.deletedId})` : d.deletedId}`
        ))
    }

    // ── add_toc ───────────────────────────────────────────────────────────────
    if (entry.action === "add_toc" && d.newTocId) {
        changeRows.push(makeDescRow(
            d.nusachName ? `${d.nusachName} (${d.newTocId})` : d.newTocId
        ))
    }

    // ── delete_toc ────────────────────────────────────────────────────────────
    if (entry.action === "delete_toc" && d.deletedId) {
        changeRows.push(makeDescRow(
            `מחיקה: ${d.deletedName ? `${d.deletedName} (${d.deletedId})` : d.deletedId}`
        ))
    }

    // ── add_translation ───────────────────────────────────────────────────────
    if (entry.action === "add_translation" && d.newTranslationId) {
        changeRows.push(makeDescRow(d.newTranslationId))
    }

    // ── delete_translation ────────────────────────────────────────────────────
    if (entry.action === "delete_translation" && d.deletedId) {
        changeRows.push(makeDescRow(`מחיקה: ${d.deletedId}`))
    }

    // ── move_items_to_part: שורה אחת לכל פריט שהוזז ─────────────────────────
    if (entry.action === "move_items_to_part" && d.movedItemIds?.length) {
        for (const itemId of d.movedItemIds) {
            changeRows.push(makeDescRow(
                `from=${d.fromPartId ?? ""} → to=${d.toPartId ?? ""}`,
                "", itemId
            ))
        }
    }

    if (changeRows.length > 0) {
        XLSX.utils.sheet_add_aoa(changesWs, changeRows, { origin: -1 })
    }

    XLSX.writeFile(wb, EXCEL_PATH)
}

/** Vite plugin: מקבל POST /__cms_excel__ עם entry בודד ומוסיף ל-Excel */
function cmsExcelPlugin() {
    return {
        name: "cms-changelog-to-excel",
        configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
            console.log("[cms-excel] plugin loaded, listening on", EXCEL_ENDPOINT)
            server.middlewares.use((req: any, res: any, next: () => void) => {
                // req.url עשוי להכיל query string – משווים עם startsWith
                if (req.method !== "POST" || !req.url?.startsWith(EXCEL_ENDPOINT)) return next()
                const chunks: Buffer[] = []
                req.on("data", (chunk: Buffer) => chunks.push(chunk))
                req.on("end", () => {
                    try {
                        const body = Buffer.concat(chunks).toString("utf8")
                        const entry = JSON.parse(body)
                        appendEntryToExcel(entry)
                        console.log(`[cms-excel] ✓ entry saved → ${EXCEL_PATH} (action: ${entry.action})`)
                        res.statusCode = 204
                        res.end()
                    } catch (err) {
                        console.error("[cms-excel] ✗ failed to write Excel entry:", err)
                        res.statusCode = 500
                        res.end()
                    }
                })
            })
        },
    }
}
// ─────────────────────────────────────────────────────────────────────────────

/** במצב dev: POST ל-/__cms_changelog__ שומר את גוף הבקשה ב-docs/cms-changelog.json */
function cmsChangelogPlugin() {
    return {
        name: "cms-changelog-to-docs",
        configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
            server.middlewares.use((req: any, res: any, next: () => void) => {
                if (req.method !== "POST" || req.url !== CHANGELOG_ENDPOINT) return next()
                const chunks: Buffer[] = []
                req.on("data", (chunk: Buffer) => chunks.push(chunk))
                req.on("end", () => {
                    try {
                        const body = Buffer.concat(chunks).toString("utf8")
                        const dir = path.dirname(DOCS_CHANGELOG_PATH)
                        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
                        fs.writeFileSync(DOCS_CHANGELOG_PATH, body, "utf8")
                        res.statusCode = 204
                        res.end()
                    } catch {
                        res.statusCode = 500
                        res.end()
                    }
                })
            })
        },
    }
}

// https://vitejs.dev/config/
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
        globals: true,
    },
    server: {
        proxy: {
            "/api": {
                target: "https://api.firecms.co",
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/api/, ""),
            },
        },
    },
    esbuild: {
        logOverride: { "this-is-undefined-in-esm": "silent" }
    },
    optimizeDeps: {
        include: ["firebase/app", "firebase/auth", "@firebase/auth"]
    },
    plugins: [
        cmsChangelogPlugin(),
        cmsExcelPlugin(),
        react(),
        federation({
            name: "remote_app",
            filename: "remoteEntry.js",
            exposes: {
                "./config": "./src/index"
            },
            shared: [
                "react",
                "react-dom",
                "@firecms/cloud",
                "@firecms/core",
                "@firecms/firebase",
                "@firecms/ui",
                "@firebase/firestore",
                "@firebase/app",
                "@firebase/functions",
                "@firebase/auth",
                "@firebase/storage",
                "@firebase/analytics",
                "@firebase/remote-config",
                "@firebase/app-check"
            ]
        })
    ],
    build: {
        modulePreload: false,
        minify: false,
        target: "ESNEXT",
        cssCodeSplit: false,
    }
});
