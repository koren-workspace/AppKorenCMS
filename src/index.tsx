import { buildProperty } from "@firecms/core";
import { SampleEntityView } from "./entity_views/SampleEntityView";
import { TocTranslationsView } from "./views/TocTranslationsView";
import { AppCopyView } from "./views/AppCopyView";
import { ChangeLogView } from "./views/ChangeLogView";
import { CouponsView } from "./views/CouponsView";
import { AppFlagsView } from "./views/AppFlagsView";
import { catalogCollection } from "./collections/catalog";

const appConfig = {
    version: "1",
    // The Mods catalog is edited through the plain Firecms collection screen (docs/catalog.md).
    collections: [catalogCollection],
    views: [
        {
            path: "toc-translations",
            name: "CMS אפלקציה סידור לתפילה",
            view: <TocTranslationsView />,
        },
        {
            path: "app-copy",
            name: "עריכת טקסטים באפליקציה",
            view: <AppCopyView />,
        },
        {
            path: "change-log",
            name: "יומן שינויים",
            view: <ChangeLogView />,
        },
        {
            path: "coupons",
            name: "קופונים",
            view: <CouponsView />,
        },
        {
            path: "app-flags",
            name: "הגדרות אפליקציה",
            view: <AppFlagsView />,
        },
    ],
    propertyConfigs: {
        color: {
            key: "color",
            name: "String with color",
            property: buildProperty({
                dataType: "string",
                name: "Main color",
                Preview: ({ value }: { value: string }) => {
                    return <div style={{
                        width: 20,
                        height: 20,
                        backgroundColor: value,
                        borderRadius: "4px",
                    }}/>;
                },
            }),
        }
    },
    entityViews: [
        {
            key: "sample_entity_view",
            name: "Sample entity view",
            Builder: SampleEntityView
        }
    ]
}

export default appConfig;
