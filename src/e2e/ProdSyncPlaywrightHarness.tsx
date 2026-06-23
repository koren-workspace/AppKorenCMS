import React, { useMemo, useState } from "react";
import { PartEditToolbar } from "../views/toc-translations/components/PartEditToolbar";
import { TocAndTranslationColumns } from "../views/toc-translations/components/TocAndTranslationColumns";
import { DateFilterBar } from "../views/toc-translations/components/DateFilterBar";
import { ProdAuthModal } from "../views/toc-translations/components/ProdAuthModal";

declare global {
    interface Window {
        __prodSyncHarness?: {
            events: string[];
        };
    }
}

export function ProdSyncPlaywrightHarness() {
    const [pendingProdCount, setPendingProdCount] = useState(0);
    const [pendingProdNavCount, setPendingProdNavCount] = useState(0);
    const [events, setEvents] = useState<string[]>([]);
    const [filterDate, setFilterDate] = useState(new Date());
    const [hasProdSession, setHasProdSession] = useState(false);
    const [prodAuthModalOpen, setProdAuthModalOpen] = useState(false);
    const [pendingProtectedAction, setPendingProtectedAction] = useState<
        "save-prod-items" | "save-prod-nav" | null
    >(null);
    const [authScenario, setAuthScenario] = useState<
        "success" | "wrong-password" | "user-not-found"
    >("success");

    const tocItems = useMemo(
        () => [
            {
                id: "ashkenaz",
                values: {
                    nusach: "אשכנז",
                    translations: [
                        { translationId: "0-ashkenaz", label: "בסיס" },
                        { translationId: "1-ashkenaz", label: "אנגלית" },
                    ],
                },
            },
        ],
        []
    );

    const logEvent = (event: string) => {
        setEvents((prev) => {
            const next = [...prev, event];
            window.__prodSyncHarness = { events: next };
            return next;
        });
    };

    const onSaveStage = () => {
        setPendingProdCount((prev) => prev + 1);
        logEvent("save-stage");
    };

    const onSaveProdItems = () => {
        setPendingProdCount(0);
        logEvent("save-prod-items");
    };

    const addPendingNavWrites = () => {
        setPendingProdNavCount((prev) => prev + 2);
        logEvent("queue-nav-pending");
    };

    const onSaveProdNav = () => {
        setPendingProdNavCount(0);
        logEvent("save-prod-nav");
    };

    const onPublishStage = () => {
        logEvent("publish-stage");
    };

    const onPublishProd = () => {
        logEvent("publish-prod");
    };

    const runProtectedAction = (action: "save-prod-items" | "save-prod-nav") => {
        if (action === "save-prod-items") {
            onSaveProdItems();
        } else {
            onSaveProdNav();
        }
    };

    const requestProtectedAction = (action: "save-prod-items" | "save-prod-nav") => {
        if (hasProdSession) {
            runProtectedAction(action);
            return;
        }
        setPendingProtectedAction(action);
        setProdAuthModalOpen(true);
        logEvent(`open-auth-${action}`);
    };

    const authenticateForHarness = async (_email: string, _password: string) => {
        if (authScenario === "wrong-password") {
            throw { code: "auth/wrong-password" };
        }
        if (authScenario === "user-not-found") {
            throw { code: "auth/user-not-found" };
        }
        return;
    };

    const handleAuthSuccess = () => {
        setHasProdSession(true);
        setProdAuthModalOpen(false);
        logEvent("auth-success");
        const action = pendingProtectedAction;
        setPendingProtectedAction(null);
        if (action) runProtectedAction(action);
    };

    const handleAuthClose = () => {
        setProdAuthModalOpen(false);
        setPendingProtectedAction(null);
        logEvent("auth-cancel");
    };

    return (
        <div dir="rtl" className="p-4 flex flex-col gap-4">
            <h1 className="text-xl font-bold" data-testid="harness-title">
                Playwright Prod Sync Harness
            </h1>

            <div className="flex gap-3 items-center">
                <button
                    type="button"
                    onClick={addPendingNavWrites}
                    className="px-3 py-1 rounded border bg-slate-100"
                >
                    צור pending מבנה
                </button>
                <span data-testid="pending-items">pendingItems: {pendingProdCount}</span>
                <span data-testid="pending-nav">pendingNav: {pendingProdNavCount}</span>
                <span data-testid="prod-session">prodSession: {hasProdSession ? "on" : "off"}</span>
            </div>
            <div className="flex gap-2 items-center">
                <label htmlFor="auth-scenario">תרחיש auth:</label>
                <select
                    id="auth-scenario"
                    data-testid="auth-scenario"
                    value={authScenario}
                    onChange={(e) =>
                        setAuthScenario(
                            e.target.value as "success" | "wrong-password" | "user-not-found"
                        )
                    }
                    className="border rounded px-2 py-1"
                >
                    <option value="success">success</option>
                    <option value="wrong-password">wrong-password</option>
                    <option value="user-not-found">user-not-found</option>
                </select>
                <button
                    type="button"
                    onClick={() => setHasProdSession(false)}
                    className="px-3 py-1 rounded border bg-slate-100"
                >
                    אפס סשן פרוד
                </button>
            </div>

            <DateFilterBar
                filterDate={filterDate}
                onDateChange={setFilterDate}
                showAll={false}
                onShowAllToggle={() => {}}
                relevantDateSetIds={["100"]}
                hebrewLabel="היום"
                isLoading={false}
                selectedTocId="ashkenaz"
                publishNusachLabel="אשכנז"
                saving={false}
                onFinalPublish={onPublishStage}
                onPublishToProd={onPublishProd}
            />

            <PartEditToolbar
                selectedGroupId="2011010"
                selectedTocId="ashkenaz"
                saving={false}
                hasChanges={true}
                onSaveGroup={onSaveStage}
                onSavePartToProd={() => requestProtectedAction("save-prod-items")}
                pendingProdCount={pendingProdCount}
            />

            <TocAndTranslationColumns
                tocItems={tocItems}
                selectedTocId="ashkenaz"
                onSelectToc={() => {}}
                translations={tocItems[0].values.translations}
                selectedTranslationIndex={0}
                onSelectTranslation={() => {}}
                isSaving={false}
                pendingProdNavCount={pendingProdNavCount}
                onSaveTocToProd={() => requestProtectedAction("save-prod-nav")}
            />

            <ProdAuthModal
                open={prodAuthModalOpen}
                email="test@example.com"
                authenticate={authenticateForHarness}
                onSuccess={handleAuthSuccess}
                onClose={handleAuthClose}
            />

            <div data-testid="event-log">{events.join(",")}</div>
        </div>
    );
}
