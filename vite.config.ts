/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import federation from "@originjs/vite-plugin-federation"
import path from "path"
import fs from "fs"
import { createRequire } from "module"
import type * as XLSXTypes from "xlsx"
import type * as GoogleApisTypes from "googleapis"

// xlsx הוא מודול CJS – createRequire מבטיח טעינה תקינה גם בסביבת ESM
const _require = createRequire(import.meta.url)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = _require("xlsx") as typeof XLSXTypes
const { google } = _require("googleapis") as typeof GoogleApisTypes

const CHANGELOG_ENDPOINT = "/__cms_changelog__"
const DOCS_CHANGELOG_PATH = path.resolve(process.cwd(), "docs", "cms-changelog.json")

// ─── Excel Audit Trail ────────────────────────────────────────────────────────
const EXCEL_ENDPOINT = "/__cms_excel__"
const EXCEL_PATH = path.resolve(process.cwd(), "docs", "cms-changes.xlsx")
const SHEETS_ENDPOINT = "/__cms_sheets__"
const GOOGLE_SERVICE_ACCOUNT_PATH = path.resolve(process.cwd(), ".google-service-account.json")

/** שמות ה-sheets ב-Excel */
const SHEET_CHANGES = "שינויים"
const SHEET_SAVES = "שמירות"

/** כותרות עמודות לכל sheet */
const HEADERS_SAVES = [
    "save_id", "תאריך_ושעה", "פעולה",
    "tocId", "שם_נוסח", "translationId", "שם_תרגום", "prayerId", "שם_תפילה", "partId", "שם_מקטע",
    "מספר_שינויים", "סיכום",
    "נשמר_Firestore", "פורסם_Bagel",
]
const HEADERS_CHANGES = [
    "save_id", "תאריך_ושעה", "פעולה",
    "נוסח", "תרגום", "קטגוריה", "תפילה", "מקטע", "partId",
    "itemId", "תוכן_פריט", "mit_id",
    "שדה", "לפני", "אחרי",
    "סטטוס",
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
        ctx.tocName ?? "",
        ctx.translationId ?? "",
        ctx.translationName ?? "",
        ctx.prayerId ?? "",
        ctx.prayerName ?? "",
        ctx.partId ?? "",
        ctx.partName ?? "",
        changesCount,
        buildSummary(entry),
        entry.savedToFirestore != null ? (entry.savedToFirestore ? "כן" : "לא") : "",
        entry.publishedToBagel != null ? (entry.publishedToBagel ? "כן" : "לא") : "",
    ]], { origin: -1 })

    // ── שורות ב"שינויים" ────────────────────────────────────────────────────
    const changeRows: any[][] = []
    const hatzliach = getHatzliach(entry)

    const nusach   = ctx.tocId ?? ""
    const trgum    = ctx.translationId ?? ""
    const category = ctx.categoryName ?? ctx.categoryId ?? ""
    const prayer   = ctx.prayerId ?? ""
    const partIdCtx = ctx.partId ?? ""

    /** בונה שורה אחת לגיליון שינויים */
    function makeRow(opts: {
        nusach?: string; trgum?: string; category?: string; prayer?: string
        makatav?: string; partId?: string; itemId?: string; itemContent?: string; mitId?: string
        sade?: string; lifnei?: string; acharei?: string
    }): any[] {
        return [
            entry.id ?? "", dt, entry.action ?? "",
            opts.nusach  ?? "", opts.trgum    ?? "", opts.category ?? "",
            opts.prayer  ?? "", opts.makatav  ?? "", opts.partId   ?? "",
            opts.itemId  ?? "", opts.itemContent ?? "", opts.mitId    ?? "",
            opts.sade    ?? "", opts.lifnei   ?? "", opts.acharei  ?? "",
            hatzliach,
        ]
    }

    // ── save_part_items: שורה לכל שינוי שדה בכל פריט ─────────────────────
    if (d.fieldChanges?.length) {
        for (const fc of d.fieldChanges) {
            for (const c of fc.changes ?? []) {
                changeRows.push(makeRow({
                    nusach, trgum, category, prayer,
                    makatav: partIdCtx, partId: partIdCtx,
                    itemId: fc.itemId ?? "", itemContent: fc.itemContent ?? "", mitId: fc.mitId ?? "",
                    sade: c.field ?? "",
                    lifnei: c.oldValue != null ? String(c.oldValue) : "",
                    acharei: c.newValue != null ? String(c.newValue) : "",
                }))
            }
        }
    }

    // ── delete_part_item ────────────────────────────────────────────────────
    if (d.deletedItemId) {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: partIdCtx, partId: partIdCtx,
            itemId: d.deletedItemId, itemContent: d.deletedItemContent ?? "", mitId: d.deletedEntityId ?? "",
            sade: "פריט", lifnei: d.deletedItemId, acharei: "",
        }))
    }

    // ── create_translation_item ─────────────────────────────────────────────
    if (d.newItemId && entry.action === "create_translation_item") {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: partIdCtx, partId: partIdCtx,
            itemId: d.newItemId, itemContent: d.newItemContent ?? "", mitId: d.newMitId ?? "",
            sade: "פריט_תרגום", lifnei: "", acharei: d.newItemId,
        }))
    }

    // ── add_part ─────────────────────────────────────────────────────────────
    if (entry.action === "add_part" && d.newPartId) {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: d.partName ?? d.newPartId, partId: d.newPartId,
            sade: "מקטע", lifnei: "", acharei: d.partName ?? d.newPartId,
        }))
    }

    // ── delete_part ──────────────────────────────────────────────────────────
    if (entry.action === "delete_part" && d.deletedId) {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: d.deletedName ?? d.deletedId, partId: d.deletedId,
            sade: "מקטע", lifnei: d.deletedName ?? d.deletedId, acharei: "",
        }))
    }

    // ── add_prayer ───────────────────────────────────────────────────────────
    if (entry.action === "add_prayer" && d.newPrayerId) {
        changeRows.push(makeRow({
            nusach, trgum, category,
            prayer: d.prayerName ?? d.newPrayerId,
            sade: "תפילה", lifnei: "", acharei: d.prayerName ?? d.newPrayerId,
        }))
    }

    // ── delete_prayer ────────────────────────────────────────────────────────
    if (entry.action === "delete_prayer" && d.deletedId) {
        changeRows.push(makeRow({
            nusach, trgum, category,
            prayer: d.deletedName ?? d.deletedId,
            sade: "תפילה", lifnei: d.deletedName ?? d.deletedId, acharei: "",
        }))
    }

    // ── add_category ─────────────────────────────────────────────────────────
    if (entry.action === "add_category" && d.newCategoryId) {
        changeRows.push(makeRow({
            nusach, trgum,
            category: d.categoryName ?? d.newCategoryId,
            sade: "קטגוריה", lifnei: "", acharei: d.categoryName ?? d.newCategoryId,
        }))
    }

    // ── delete_category ──────────────────────────────────────────────────────
    if (entry.action === "delete_category" && d.deletedId) {
        changeRows.push(makeRow({
            nusach, trgum,
            category: d.deletedName ?? d.deletedId,
            sade: "קטגוריה", lifnei: d.deletedName ?? d.deletedId, acharei: "",
        }))
    }

    // ── add_toc ───────────────────────────────────────────────────────────────
    if (entry.action === "add_toc" && d.newTocId) {
        changeRows.push(makeRow({
            nusach: d.nusachName ?? d.newTocId,
            sade: "נוסח", lifnei: "", acharei: d.nusachName ?? d.newTocId,
        }))
    }

    // ── delete_toc ────────────────────────────────────────────────────────────
    if (entry.action === "delete_toc" && d.deletedId) {
        changeRows.push(makeRow({
            nusach: d.deletedName ?? d.deletedId,
            sade: "נוסח", lifnei: d.deletedName ?? d.deletedId, acharei: "",
        }))
    }

    // ── add_translation ───────────────────────────────────────────────────────
    if (entry.action === "add_translation" && d.newTranslationId) {
        changeRows.push(makeRow({
            nusach, trgum: d.newTranslationId,
            sade: "תרגום", lifnei: "", acharei: d.newTranslationId,
        }))
    }

    // ── delete_translation ────────────────────────────────────────────────────
    if (entry.action === "delete_translation" && d.deletedId) {
        changeRows.push(makeRow({
            nusach, trgum: d.deletedId,
            sade: "תרגום", lifnei: d.deletedId, acharei: "",
        }))
    }

    // ── move_items_to_part: שורה לכל פריט שהוזז ──────────────────────────────
    if (entry.action === "move_items_to_part" && d.movedItemIds?.length) {
        for (const itemId of d.movedItemIds) {
            changeRows.push(makeRow({
                nusach, trgum, category, prayer,
                partId: d.fromPartId ?? "", itemId,
                sade: "מיקום",
                lifnei: d.fromPartId ?? "", acharei: d.toPartId ?? "",
            }))
        }
    }

    // ── split_part: פיצול מקטע ────────────────────────────────────────────────
    if (entry.action === "split_part" && d.fromPartId) {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: d.partName ?? d.newPartId ?? "", partId: d.fromPartId ?? "",
            sade: "פיצול_מקטע",
            lifnei: d.fromPartId ?? "",
            acharei: `${d.partName ?? ""} (${d.newPartId ?? ""})`,
        }))
    }

    // ── publish_to_bagel ──────────────────────────────────────────────────────
    if (entry.action === "publish_to_bagel") {
        changeRows.push(makeRow({
            nusach,
            sade: "פרסום", lifnei: "", acharei: "publish_to_bagel",
        }))
    }

    // ── update_category ───────────────────────────────────────────────────────
    if (entry.action === "update_category") {
        changeRows.push(makeRow({
            nusach, trgum,
            category: d.categoryName ?? d.categoryId ?? "",
            sade: "שם_קטגוריה", lifnei: "", acharei: d.nameHe ?? "",
        }))
    }

    // ── update_prayer ─────────────────────────────────────────────────────────
    if (entry.action === "update_prayer") {
        changeRows.push(makeRow({
            nusach, trgum, category,
            prayer: d.prayerId ?? "",
            sade: "שם_תפילה", lifnei: "", acharei: d.nameHe ?? "",
        }))
    }

    // ── update_part ───────────────────────────────────────────────────────────
    if (entry.action === "update_part") {
        changeRows.push(makeRow({
            nusach, trgum, category, prayer,
            makatav: d.nameHe ?? d.partId ?? "", partId: d.partId ?? "",
            sade: "שם_מקטע", lifnei: "", acharei: d.nameHe ?? "",
        }))
    }

    // ── update_toc ────────────────────────────────────────────────────────────
    if (entry.action === "update_toc") {
        changeRows.push(makeRow({
            nusach: d.nusach ?? nusach,
            sade: "שם_נוסח", lifnei: "", acharei: d.nusach ?? "",
        }))
    }

    if (changeRows.length > 0) {
        XLSX.utils.sheet_add_aoa(changesWs, changeRows, { origin: -1 })
    }

    XLSX.writeFile(wb, EXCEL_PATH)
}

type SheetsAppendBody = {
    spreadsheetId?: string
    sheetName?: string
    rows?: unknown
    rowObjects?: unknown
}

type HeaderRowObject = Record<string, string | number | boolean | null>

async function appendRowsToGoogleSheets(body: SheetsAppendBody): Promise<void> {
    if (!fs.existsSync(GOOGLE_SERVICE_ACCOUNT_PATH)) {
        throw new Error(`Missing service account file at ${GOOGLE_SERVICE_ACCOUNT_PATH}`)
    }
    const spreadsheetId = body.spreadsheetId || process.env.VITE_GOOGLE_SHEETS_SPREADSHEET_ID
    const sheetName = body.sheetName || process.env.VITE_GOOGLE_SHEETS_SHEET_NAME
    if (!spreadsheetId || !sheetName) {
        throw new Error("Missing spreadsheetId/sheetName in request and env")
    }
    const serviceAccountRaw = fs.readFileSync(GOOGLE_SERVICE_ACCOUNT_PATH, "utf8")
    const serviceAccount = JSON.parse(serviceAccountRaw)
    const auth = new google.auth.GoogleAuth({
        credentials: serviceAccount,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    })
    const authClient = await auth.getClient()
    const sheetsApi = google.sheets({ version: "v4", auth: authClient as any })
    let valuesToAppend: any[][] = []

    if (Array.isArray(body.rowObjects) && body.rowObjects.length > 0) {
        const rowObjects = body.rowObjects as unknown[]
        if (!rowObjects.every((row) => row != null && typeof row === "object" && !Array.isArray(row))) {
            throw new Error("rowObjects חייב להיות מערך של אובייקטים")
        }
        const headerRes = await sheetsApi.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!1:1`,
        })
        const headers = (headerRes.data.values?.[0] ?? []).map((h) => String(h).trim())
        if (headers.length === 0) {
            throw new Error(`No header row found in sheet "${sheetName}"`)
        }
        const headerIndex = new Map<string, number>()
        headers.forEach((h, i) => headerIndex.set(h, i))
        valuesToAppend = rowObjects.map((obj) => {
            const typedObj = obj as HeaderRowObject
            const payloadHeaders = Object.keys(typedObj)
            const missing = payloadHeaders.filter((h) => !headerIndex.has(h))
            if (missing.length > 0) {
                console.warn(`[cms-sheets] missing headers in "${sheetName}" (skipping values): ${missing.join(", ")}`)
            }
            const row = new Array(headers.length).fill("")
            Object.entries(typedObj).forEach(([header, value]) => {
                const idx = headerIndex.get(header)
                if (idx == null) return
                row[idx] = value == null ? "" : value
            })
            return row
        })
    } else if (Array.isArray(body.rows) && body.rows.length > 0) {
        const rows = body.rows as unknown[]
        if (!rows.every((row) => Array.isArray(row))) {
            throw new Error("rows חייב להיות מערך של מערכים")
        }
        valuesToAppend = rows as any[][]
    } else {
        throw new Error("rows או rowObjects חייבים להיות מערך לא ריק")
    }

    await sheetsApi.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:ZZ`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
            values: valuesToAppend,
        },
    })
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

/** Vite plugin: מקבל POST /__cms_sheets__ וכותב שורות ל-Google Sheets */
function cmsSheetsPlugin() {
    return {
        name: "cms-google-sheets",
        configureServer(server: { middlewares: { use: (fn: (req: any, res: any, next: () => void) => void) => void } }) {
            console.log("[cms-sheets] plugin loaded, listening on", SHEETS_ENDPOINT)
            server.middlewares.use((req: any, res: any, next: () => void) => {
                if (req.method !== "POST" || !req.url?.startsWith(SHEETS_ENDPOINT)) return next()
                const chunks: Buffer[] = []
                req.on("data", (chunk: Buffer) => chunks.push(chunk))
                req.on("end", async () => {
                    try {
                        const bodyRaw = Buffer.concat(chunks).toString("utf8")
                        const body = JSON.parse(bodyRaw) as SheetsAppendBody
                        await appendRowsToGoogleSheets(body)
                        res.statusCode = 204
                        res.end()
                    } catch (err) {
                        console.error("[cms-sheets] ✗ failed to append rows:", err)
                        res.statusCode = 500
                        res.end()
                    }
                })
            })
        },
    }
}

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
        cmsSheetsPlugin(),
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
