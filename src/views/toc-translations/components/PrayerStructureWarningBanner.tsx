import React from "react";

type PrayerStructureWarningBannerProps = {
    message: string | null;
};

export function PrayerStructureWarningBanner({ message }: PrayerStructureWarningBannerProps) {
    if (!message) return null;

    return (
        <div
            className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 shrink-0"
            role="alert"
        >
            <span className="text-base leading-none mt-0.5" aria-hidden="true">
                ⚠
            </span>
            <p className="leading-snug">{message}</p>
        </div>
    );
}
