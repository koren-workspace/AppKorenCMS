export const INSERT_AT_START = "__start__";

export function isInsertAtStart(value: string | null | undefined): boolean {
    return value === INSERT_AT_START;
}
