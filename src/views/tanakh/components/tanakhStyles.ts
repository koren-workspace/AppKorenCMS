/** סגנונות משותפים למסך התנ"ך למטייל (אותה שפה חזותית כמו שאר מסכי ה-CMS) */

import type React from "react";

export const BLUE = "#1565c0";
export const GREEN = "#2e7d32";
export const RED = "#b71c1c";
export const AMBER = "#8a4b00";

export const ts: Record<string, React.CSSProperties> = {
    page: { direction: "rtl", padding: "16px 20px 40px", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: 12, minHeight: "calc(100vh - 64px)" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" },
    title: { margin: 0, fontSize: 20, fontWeight: 700 },
    subtitle: { margin: "2px 0 0", fontSize: 13, color: "#666" },
    banner: { borderRadius: 6, padding: "10px 14px", fontSize: 14, lineHeight: 1.6 },
    bannerInfo: { background: "#e3f2fd", color: "#0d47a1" },
    bannerSuccess: { background: "#e8f5e9", color: "#1b5e20" },
    bannerError: { background: "#fdecea", color: RED },
    bannerWarn: { background: "#fff3e0", color: AMBER },
    workspace: { display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", gap: 16, alignItems: "start" },
    card: { border: "1px solid #e0e0e0", borderRadius: 8, background: "#fff", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 },
    cardTitle: { margin: 0, fontSize: 15, fontWeight: 700 },
    row: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" },
    label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#444", minWidth: 0 },
    input: { borderWidth: 1, borderStyle: "solid", borderColor: "#ccc", borderRadius: 6, padding: "7px 10px", fontSize: 14, fontWeight: 400, width: "100%", boxSizing: "border-box", background: "#fff" },
    inputLtr: { direction: "ltr", textAlign: "left" },
    textarea: { borderWidth: 1, borderStyle: "solid", borderColor: "#ccc", borderRadius: 6, padding: "8px 10px", fontSize: 14, fontWeight: 400, width: "100%", boxSizing: "border-box", lineHeight: 1.6, resize: "vertical", fontFamily: "inherit", background: "#fff" },
    select: { border: "1px solid #ccc", borderRadius: 6, padding: "7px 10px", fontSize: 14, background: "#fff" },
    code: { fontSize: 12, background: "#f0f0f0", borderRadius: 4, padding: "1px 6px", direction: "ltr", unicodeBidi: "isolate", fontFamily: "monospace" },
    hint: { fontSize: 12, color: "#777", margin: 0, lineHeight: 1.5 },
    primaryBtn: { padding: "8px 18px", borderRadius: 6, border: "none", background: BLUE, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    successBtn: { padding: "8px 18px", borderRadius: 6, border: "none", background: GREEN, color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 },
    secondaryBtn: { border: "1px solid #ccc", background: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: "#444" },
    dangerBtn: { border: "1px solid #e57373", background: "#fff", borderRadius: 6, padding: "6px 12px", fontSize: 13, cursor: "pointer", color: RED },
    smallBtn: { border: "1px solid #ccc", background: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 12, cursor: "pointer", color: "#444", lineHeight: 1.4 },
    chip: { display: "inline-flex", alignItems: "center", gap: 6, borderWidth: 1, borderStyle: "solid", borderColor: "#cfd8dc", borderRadius: 999, padding: "2px 10px", fontSize: 13, background: "#f5f7f9" },
    chipActive: { background: "#e3f2fd", borderColor: BLUE, color: "#0d47a1" },
    badge: { display: "inline-block", fontSize: 11, borderRadius: 4, padding: "0 6px", lineHeight: 1.6, fontWeight: 600 },
    fieldError: { color: RED, fontSize: 12, margin: 0 },
    fieldWarn: { color: AMBER, fontSize: 12, margin: 0 },
    section: { borderTop: "1px solid #eee", paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 },
    sectionTitle: { margin: 0, fontSize: 14, fontWeight: 700, color: "#333" },
    twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    list: { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 },
    listRow: { display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, cursor: "pointer", fontSize: 14, borderWidth: 1, borderStyle: "solid", borderColor: "transparent" },
    listRowActive: { background: "#e3f2fd", borderColor: "#90caf9" },
    muted: { color: "#777", fontSize: 12 },
};
