import { FireCMSAppConfig } from "@firecms/cloud";
import { SampleEntityView } from "./entity_views/SampleEntityView";
import { TocTranslationsView } from "./views/TocTranslationsView";
import { demoCollection } from "./collections/demo";

const appConfig: FireCMSAppConfig = {
    version: "1",
    onFirebaseInit: (config) => {
        console.log("[Firebase] האפליקציה משתמשת במפתח (מ-FireCMS Cloud):", (config as { apiKey?: string }).apiKey);
    },
    collections: [
        demoCollection
    ],
    views: [
        {
            path: "toc-translations",
            name: "Toc & Translations",
            view: <TocTranslationsView />,
        },
    ],
    propertyConfigs: [{
        name: "String with color",
        key: "color",
        property: {
            dataType: "string",
            name: "Main color",
            Preview: ({ value }) => {
                return <div style={{
                    width: 20,
                    height: 20,
                    backgroundColor: value,
                    borderRadius: "4px",
                }}/>;
            },
        },
    }],
    entityViews: [
        {
            key: "sample_entity_view",
            name: "Sample entity view",
            Builder: SampleEntityView
        }
    ]
}

export default appConfig;
