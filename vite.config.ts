/// <reference types="vitest/config" />
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import federation from "@originjs/vite-plugin-federation"
import path from "path"
import fs from "fs"

const CHANGELOG_ENDPOINT = "/__cms_changelog__"
const DOCS_CHANGELOG_PATH = path.resolve(process.cwd(), "docs", "cms-changelog.json")

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
