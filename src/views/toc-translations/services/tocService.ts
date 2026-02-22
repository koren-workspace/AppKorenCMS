import { buildCollection, Entity } from "@firecms/cloud";

const tocCollection = buildCollection({
    id: "base",
    path: "base",
    name: "base",
    properties: {}
});

export async function fetchTocItems(dataSource: any): Promise<Entity<any>[]> {
    return dataSource.fetchCollection({
        path: "toc",
        collection: tocCollection
    });
}
