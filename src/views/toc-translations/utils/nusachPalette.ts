export type NusachPalette = {
    readonly colors: readonly [string, string, string, string, string];
    /** צבעי הרקע בעת בחירה — מוכהים יותר עבור גוונים בהירים */
    readonly selectedColors: readonly [string, string, string, string, string];
    readonly darkText: readonly [boolean, boolean, boolean, boolean, boolean];
};

const ASHKENAZ: NusachPalette = {
    colors:        ['#003A6B', '#1B5886', '#3776A1', '#5293BB', '#6EB1D6'],
    selectedColors:['#003A6B', '#1B5886', '#3776A1', '#5293BB', '#6EB1D6'],
    darkText: [false, false, false, false, false],
};

const SEFARD: NusachPalette = {
    colors:        ['#7a1a1a', '#b82525', '#d95040', '#e89a8a', '#e8b5a8'],
    //              col4 sel = midpoint(col3, col4)          col5 sel = ⅓ col4→col5
    selectedColors:['#7a1a1a', '#b82525', '#d95040', '#e07565', '#e38a7b'],
    darkText: [false, false, false, true, true],
};

const EDOT_HAMIZRAH: NusachPalette = {
    colors:        ['#281E18', '#572D0C', '#C78E3A', '#E3B76A', '#EBCF8A'],
    //              col4 sel = midpoint(col3, col4)          col5 sel = ⅓ col4→col5
    selectedColors:['#281E18', '#572D0C', '#C78E3A', '#d5a352', '#dcb265'],
    darkText: [false, false, false, true, true],
};

export function getNusachPalette(tocId: string | null | undefined): NusachPalette {
    if (!tocId) return ASHKENAZ;
    const s = tocId.toLowerCase();
    if (s.includes('sefard') || s.includes('sfard') || s.includes('sephard') || s.includes('sephardi')) return SEFARD;
    if (s.includes('mizrah') || s.includes('mizrach') || s.includes('edot') || s.includes('מזרח')) return EDOT_HAMIZRAH;
    return ASHKENAZ;
}
