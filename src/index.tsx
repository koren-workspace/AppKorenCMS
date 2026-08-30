import { buildProperty } from "@firecms/core";
import { SampleEntityView } from "./entity_views/SampleEntityView";
import { TocTranslationsView } from "./views/TocTranslationsView";
import { AppCopyView } from "./views/AppCopyView";
import { ChangeLogView } from "./views/ChangeLogView";

const appConfig = {
    version: "1",
    collections: [],
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
