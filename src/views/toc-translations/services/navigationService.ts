/**
 * navigationService – חילוץ נתוני ניווט ממבנה התרגום
 *
 * מבנה הנתונים: translation מכיל categories; כל category מכיל prayers;
 * כל prayer מכיל parts. הפונקציות מחזירות מערך לפי הבחירה הנוכחית.
 */

/** מחזיר את רשימת הקטגוריות מתוך אובייקט התרגום */
export function getPrayerCategoriesFromTranslation(translation: any): any[] {
    if (!translation || !Array.isArray(translation.categories)) return [];
    return translation.categories;
}

/** מחזיר את רשימת התפילות של הקטגוריה הנבחרת (לפי שם) */
export function getPrayersForCategory(categories: any[], selectedCategoryName: string | null): any[] {
    if (!selectedCategoryName) return [];
    const category = categories.find((item: any) => item.name === selectedCategoryName);
    if (!category || !Array.isArray(category.prayers)) return [];
    return category.prayers;
}

/** מחזיר את רשימת המקטעים (parts) של התפילה הנבחרת (לפי id) */
export function getPartsForPrayer(categories: any[], selectedPrayerId: string | null): any[] {
    if (!selectedPrayerId) return [];
    const prayers = categories.flatMap((category: any) => category.prayers ?? []);
    const prayer = prayers.find((item: any) => item.id === selectedPrayerId);
    if (!prayer || !Array.isArray(prayer.parts)) return [];
    return prayer.parts;
}
