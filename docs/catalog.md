# קטלוג מודים (catalog)

קטלוג המוצרים הנמכרים באפליקציה (תרגום, פירוש, הכנה לתפילה, תפילה מכוונת).
הקטלוג עבר מ-BagelDB (`enhancments/items`) ל-Firestore ב-2026-09; זו הייתה
הקריאה האחרונה של האפליקציה מ-Bagel. העריכה נעשית דרך מסך הקולקציה הרגיל
של Firecms ("קטלוג מודים"), בלי מסך מותאם.

## איך זה עובד

- קולקציית Firestore בשם `catalog`, בכל סביבה. **מזהה המסמך = `storeId`**
  (מזהה המוצר בחנויות, למשל `prep30`). האפליקציה מזהה בעלות לפי `storeId`,
  ולכן אין לשנות אותו במוצר קיים.
- האפליקציה (`koren-tefilla`, `src/services/remote/enhancements.ts`) קוראת
  את כל הקולקציה עם המשתמש האנונימי שלה בכל כניסה לחנות, וממיינת לפי
  `order` (0 ראשון; מסמך בלי ערך אחרון). מסמך שאינו מובן (סוג לא מוכר,
  בלי כותרת) מדולג ולא שובר את המסך.
- שדות: `storeId`, `kind`, `order`, `title` / `author` / `description` /
  `nusach` (מפות `{ default, he }`), `nusachId` (ריק = לכל הנוסחים),
  `contentId` ו-`backgroundColor` (תרגום ופירוש), `thumbnail` (URL ציבורי
  ב-Firebase Storage, תיקיית `mods/thumbnails`), ולהכנה לתפילה
  `preparationContent` – מערך רצועות `{ id, rank, title, type, url, thumbnail }`
  שמוצגות לפי `rank` בסדר יורד. `bagelId` ו-`migratedFromBagelAt` היסטוריים.
- **תמונות**: מעלים ל-Firebase Storage (קונסולה, `mods/thumbnails/`) ומדביקים
  את הכתובת הציבורית (`...?alt=media`). הקבצים שהיו בשרת התמונות של Bagel
  הועתקו לשם ב-2026-09.
- מוצר חדש דורש גם מוצר בחנויות (Google Play / App Store) עם אותו `storeId`;
  הקטלוג לבדו לא מוכר כלום.

## Bagel (האפליקציות הישנות)

האפליקציות הישנות ממשיכות לקרוא את הקטלוג מ-Bagel עד שייסגרו. שינוי כאן
**לא** מגיע אליהן; אם צריך שגם הן יראו אותו, לעדכן ידנית בקונסולת Bagel
(`enhancments`). לא למחוק שם כלום עד שהגרסה החדשה בחנויות.

## הפעלה ראשונית (חד-פעמי, לכל סביבה)

1. **חוקי אבטחה.** בלוק ל-`catalog` והחרגה מהחוק הכללי, באותו אופן שנעשה
   ל-`coupons` ול-`app-config` (ההחרגה על משתנה חד-קטעי, לא על
   `{document=**}` – ראו `docs/coupons.md`):

   ```
   match /catalog/{storeId} {
     // Every signed-in user (the app's anonymous user included) reads the catalog.
     allow read: if request.auth != null;
     // Only CMS users (signed in with an email) change it.
     allow write: if request.auth != null && request.auth.token.email != null;
   }

   match /{collection}/{docId} {
     allow read, write: if request.auth != null
       && collection != 'coupons' && collection != 'app-config' && collection != 'catalog';
   }
   match /{collection}/{docId}/{rest=**} {
     allow read, write: if request.auth != null
       && collection != 'coupons' && collection != 'app-config' && collection != 'catalog';
   }
   ```

   (בפרוד: `request.auth != null` הוא `isAllowedUser()`, כמו שאר הקובץ.)
   בלי ההחרגה, המשתמש האנונימי של האפליקציה יכול לשנות מחירים ותוכן לכולם.

2. **ייבוא הקטלוג מ-Bagel** (מהמחשב המקומי, ריפו koren-tefilla). המקור הוא
   תמיד קטלוג **הפרוד** של Bagel, גם לסטייג' (בסטייג' של Bagel יש עשרה
   מוצרי בדיקה שלא תואמים לחנויות; החלטת PO 2026-09-06):

   ```bash
   node tools/migrate-catalog.mjs --env stage             # הרצה יבשה
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> node tools/migrate-catalog.mjs --env stage --write
   ```

   הסקריפט יוצר רק מסמכים שלא קיימים; מסמך קיים לא נדרס. כתובות התמונות
   מוחלפות לכתובות ה-Storage לפי `mod-thumbnails-mapping.csv`.

3. לפתוח את המסך "קטלוג מודים" ולוודא שעשרת המוצרים מופיעים לפי הסדר.

## בדיקה בסטייג'

1. במסך, לשנות תיאור של מוצר, לשמור.
2. באפליקציה (בניית סטייג'), להיכנס לחנות המודים: השינוי מופיע, התמונות
   נטענות, רצועות ההכנה מתנגנות.
