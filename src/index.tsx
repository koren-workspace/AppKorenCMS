import { buildProperty } from "@firecms/core";
import { SampleEntityView } from "./entity_views/SampleEntityView";
import { TocTranslationsView } from "./views/TocTranslationsView";
import { demoCollection } from "./collections/demo";

const appConfig = {
    version: "1",
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
