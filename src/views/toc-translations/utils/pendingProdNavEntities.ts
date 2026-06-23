export type NavEntityType = "part" | "category" | "prayer";

export function navEntityKey(type: NavEntityType, id: string): string {
    return `${type}:${id}`;
}

export function isNavEntityPending(
    keys: Set<string> | undefined,
    type: NavEntityType,
    id: string
): boolean {
    if (!keys || !id) return false;
    return keys.has(navEntityKey(type, id));
}
