export function getPrayerCategoriesFromTranslation(translation: any): any[] {
    if (!translation || !Array.isArray(translation.categories)) return [];
    return translation.categories;
}

export function getPrayersForCategory(categories: any[], selectedCategoryName: string | null): any[] {
    if (!selectedCategoryName) return [];
    const category = categories.find((item: any) => item.name === selectedCategoryName);
    if (!category || !Array.isArray(category.prayers)) return [];
    return category.prayers;
}

export function getPartsForPrayer(categories: any[], selectedPrayerId: string | null): any[] {
    if (!selectedPrayerId) return [];
    const prayers = categories.flatMap((category: any) => category.prayers ?? []);
    const prayer = prayers.find((item: any) => item.id === selectedPrayerId);
    if (!prayer || !Array.isArray(prayer.parts)) return [];
    return prayer.parts;
}
