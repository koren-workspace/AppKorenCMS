# הגדרות אפליקציה (app-flags)

מסך CMS לשלושת **דגלי השרת** של האפליקציה. הדגלים עברו מ-BagelDB ל-Firestore
ב-2026-09; זהו המקום שבו עורכים אותם. Bagel נשאר בינתיים לאפליקציות הישנות
בלבד, ומתעדכן מהמסך הזה: אוטומטית כשאפשר, אחרת ידנית לפי ההוראות שהמסך מציג.

## הדגלים

| דגל | מה הוא עושה | ב-Bagel (ישן) |
|---|---|---|
| `freeEnhancements` | `true` = כל המודים חינם ושדה הקופון מוסתר; `false` = בתשלום | `appPreferences.freeEnhancements` |
| `minAppVersion` | build מינימלי לכל פלטפורמה; מכשיר נמוך יותר רואה מסך "חובה לעדכן"; חסר/0 = אין חסימה | `minAppVersion.android / .ios` |
| `clearTime` | חותמת זמן; מכשיר שרואה חותמת חדשה מזו ששמר מוחק את כל התוכן המקומי ומסנכרן מאפס | `clearTime.timestamp` |

## איך זה עובד

- מסמך אחד ב-Firestore: `app-config/flags`, בכל סביבה.
- **האפליקציה החדשה** (`koren-tefilla`, `services/remote/firestoreFlags.ts`)
  קוראת את המסמך פעם אחת בהפעלה, עם המשתמש האנונימי שלה, ומפיקה ממנו את
  שלושת הערכים. מסמך חסר = שגיאה (האפליקציה שומרת את הערך הקודם), ולכן
  המסמך חייב להיווצר לפני שגרסה עם השינוי מגיעה למשתמשים.
- **האפליקציות הישנות** קוראות עדיין את שלוש הקולקציות ב-Bagel. לכן כל
  שמירה במסך עושה שני דברים, לפי הסדר: כותבת ל-Firestore (מקור האמת), ואז
  קוראת ל-`PUT /api/bagel/flags` (Vercel Function; ב-dev ה-middleware של Vite),
  שכותב את אותם ערכים ל-Bagel עם הטוקן שבשרת. הדפדפן לא מחזיק טוקן Bagel.
- **אם השיקוף נכשל** (למשל לטוקן שבשרת אין הרשאה על הקולקציות), המסך מציג
  בדיוק מה להזין ידנית בקונסולת Bagel: `clearTime → timestamp`,
  `App Preferences → freeEnhancements`, `minAppVersion → android / ios`.
  החלטה (PO, 2026-09-06): Bagel זמני והדגלים משתנים לעיתים רחוקות, ולכן
  עדכון ידני ב-Bagel מקובל בינתיים; אין צורך להשקיע בטוקנים חדשים.
- **העריכה מתחילה תמיד במסך הזה**, לא ב-Bagel. שינוי ישיר ב-Bagel לא מגיע
  ל-Firestore, והאפליקציה החדשה לא תראה אותו. אם עדכנת ידנית ב-Bagel, זה רק
  אחרי שמירה כאן.

## הפעלה ראשונית (חד-פעמי, לכל סביבה)

1. **חוקי אבטחה.** להוסיף בלוק ל-`app-config` ולהחריג אותו מהחוק הכללי,
   באותו אופן שנעשה ל-`coupons` (ראו `docs/coupons.md` – ההחרגה חייבת להיות
   על משתנה חד-קטעי, לא על `{document=**}`):

   ```
   match /app-config/{docId} {
     allow read: if request.auth != null;
     allow write: if request.auth != null && request.auth.token.email != null;
   }

   match /{collection}/{docId} {
     allow read, write: if request.auth != null && collection != 'coupons' && collection != 'app-config';
   }
   match /{collection}/{docId}/{rest=**} {
     allow read, write: if request.auth != null && collection != 'coupons' && collection != 'app-config';
   }
   ```

   (בפרוד: `request.auth != null` הוא `isAllowedUser()`, כמו שאר הקובץ.)
   בלי ההחרגה, המשתמש האנונימי של האפליקציה יכול לכתוב `clearTime` ולמחוק
   תוכן אצל כולם.

2. **יצירת המסמך מהערכים הנוכחיים ב-Bagel** (מהמחשב המקומי, ריפו koren-tefilla):

   ```bash
   node tools/migrate-flags.mjs --env stage             # הרצה יבשה
   GOOGLE_APPLICATION_CREDENTIALS=<sa.json> node tools/migrate-flags.mjs --env stage --write
   ```

   הסקריפט יוצר רק אם המסמך לא קיים; מסמך קיים לא נדרס.

3. **טוקן Bagel בשרת (אופציונלי – רק לשיקוף אוטומטי).** הפונקציה משתמשת
   ב-`BAGEL_TOKEN` (סטייג') ו-`PROD_BAGEL_TOKEN` (פרוד) מסביבת Vercel, כמו
   update-time; ב-dev מקומי `BAGEL_TOKEN` או `VITE_BAGEL_TOKEN` ב-`.env.local`.
   כדי שהשיקוף יעבוד, הטוקן צריך read+update על `clearTime`, `App Preferences`
   ו-`minAppVersion`. נבדק 2026-09-06: הטוקן הקיים מורשה ל-`updateTime` בלבד,
   ולכן השיקוף נכשל והמסך מציג את ההוראות הידניות. אם ירצו שיקוף אוטומטי:
   טוקן חדש בקונסולת Bagel עם ההרשאות האלה, והחלפת המשתנה ב-Vercel.

## בדיקה בסטייג'

1. במסך, סביבת Stage: להעלות `minAppVersion` לאנדרואיד ל-99999, שמירה.
2. לוודא שהערך הופיע ב-Firestore (קונסולה, `app-config/flags`) וב-Bagel של
   סטייג' (`minAppVersion`). המסך מציג את תוצאת השיקוף בשורת ההודעה.
3. לפתוח APK סטייג': מסך "חובה לעדכן" חוסם.
4. להחזיר את הערך, שמירה, לפתוח שוב: המסך נעלם.
