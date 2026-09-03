# קופונים (coupons)

מסך CMS לניהול **קודי קופון** שמעניקים מודים באפליקציה בלי עסקה בחנות
(מתנות, קמפיינים). הקופונים עברו מ-BagelDB ל-Firestore ב-2026-09; זהו
המקום היחיד שבו עורכים אותם.

## איך זה עובד

- קולקציית Firestore בשם `coupons`, בכל סביבה (koren-stage / koren-c51c8).
- **מזהה המסמך = SHA-256 של הקוד המנורמל** (אותיות גדולות, רק A–Z 0–9).
  הקוד הקריא לא נשמר בשום מקום בשרת: הוא מוצג פעם אחת ביצירה, ומי שמחזיק
  בו יכול למצוא את המסמך; מי שלא – לא (החוקים אוסרים `list`).
- שדות: `name` (תווית פנימית), `storeIds` (מערך מזהי מוצר בחנות, למשל
  `prep30`), `expiresAt` (Timestamp, חובה), `active` (מתג כיבוי),
  `createdAt`, ו-`usedAt` (Timestamp; **היעדרו** = טרם נוצל).
- האפליקציה (`koren-tefilla`, `src/services/remote/coupons.ts`) מחשבת את
  ה-hash של מה שהמשתמש הקליד, קוראת את המסמך `coupons/{hash}` עם המשתמש
  האנונימי שלה (אותו משתמש של סנכרון התוכן), ואם הקופון תקף – מעניקה את
  המוצרים וכותבת `usedAt`. זו הכתיבה היחידה שהאפליקציה עושה לשרת.
- **החד-פעמיות נאכפת בשרת**: החוקים מאפשרים לכתוב `usedAt` רק לקופון פעיל,
  בתוקף ושטרם נוצל, ורק לשדה הזה. שני מכשירים שפודים את אותו קוד באותה שנייה –
  השני מקבל 403.

## זרימת עבודה במסך

1. בוחרים סביבה. **Stage** (ברירת מחדל) לבדיקות עם build של סטייג';
   **פרוד** דורש אימות פרוד (כמו "פרסום לפרוד") ומסומן באדום.
2. "קופון חדש": שם, מוצרים (הרשימה הקבועה של 10 מזהי הפרוד; ל-Stage או
   למוצר שאינו ברשימה – שדה "מזהים נוספים"), תוקף. לחיצה מנפיקה קוד אקראי
   (XXXX-XXXX, אלפבית בלי O/0/I/1/L), מחשבת hash, וכותבת מסמך.
3. **הקוד מוצג פעם אחת.** להעתיק ולשלוח למקבל / לרשום בגיליון. אחרי סגירה
   אין דרך לשחזר אותו – רק להנפיק קופון חדש.
4. "איתור לפי קוד": מדביקים קוד (או hash) ומקבלים את השורה – כך מכבים קוד
   שדלף (כפתור "כיבוי"), או בודקים אם נוצל.
5. "איפוס ניצול" מוחק את `usedAt` (לבדיקות; או החלטה מפורשת להעניק שוב).

הכלי `koren-tefilla/tools/coupon-codes.mjs` ממשיך לעבוד להנפקה בכמויות
(`new 25`) ולחישוב hash של קוד קיים (`hash ABCD-1234`); הנרמול שלו, של
האפליקציה ושל `src/views/coupons/codes.ts` כאן חייבים להישאר זהים – בדיקה
בכל אחד מהם מצמידה את ה-digest של `ABCD-2345`.

## הפעלה ראשונית (חד-פעמי)

1. **חוקי אבטחה (Firebase console → Firestore → Rules, בשני הפרויקטים).**
   האפליקציה קוראת עם Anonymous Auth ומעדכנת שדה אחד; משתמשי ה-CMS
   (email/password) עורכים הכול:

   ```
   match /coupons/{codeHash} {
     // CMS users (signed in with an email) manage coupons freely.
     allow read, write: if request.auth != null && request.auth.token.email != null;

     // The app: fetch ONE coupon by id (never list), and mark it used once.
     allow get: if request.auth != null;
     allow list: if false;
     allow update: if request.auth != null
       && resource.data.active == true
       && resource.data.expiresAt > request.time
       && resource.data.get('usedAt', null) == null
       && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['usedAt'])
       && request.resource.data.usedAt is timestamp;
   }
   ```

   בדיקה מהירה אחרי הפרסום: משתמש אנונימי מקבל 403 על `list`, ו-403 על
   `update` שני לאותו מסמך. הבדיקה החיה באפליקציה עושה בדיוק את זה:
   `COUPON_E2E=1 npx jest couponsLive` (מול Stage; דורש קופון `E2E TEST-4KZC`
   לא-מנוצל, ראו הקובץ).

2. **העברת הקופונים הקיימים מ-Bagel** (פעם אחת לכל סביבה, מהמחשב המקומי):

   ```bash
   # koren-tefilla
   BAGEL_COUPONS_TOKEN=<coupons_app של הסביבה> node tools/migrate-coupons.mjs --env stage
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> BAGEL_COUPONS_TOKEN=… node tools/migrate-coupons.mjs --env stage --write
   ```

   הרצה יבשה מדפיסה את הרשימה ולא כותבת; `--write` יוצר רק מסמכים שאינם
   קיימים (מסמך קיים לא נדרס). ב-2026-09-03 היו בפרוד קופון בדיקה אחד
   ("PROD CHECK") ובסטייג' שלושה.

3. אין צורך ב-Vercel Function וב-service account בשרת: האכיפה כולה בחוקים,
   והאפליקציה עובדת עם אותו Anonymous Auth שכבר יש לה.

## מה עוד לא כאן

- **יומן שינויים**: יצירה/כיבוי/מחיקה של קופונים לא נרשמים עדיין ב-`cms_change_log`.
- **קישור לקטלוג**: רשימת המוצרים קבועה בקוד (`STORE_PRODUCTS`); כשהקטלוג
  יעבור ל-FireCMS, מקשרים אליו.
