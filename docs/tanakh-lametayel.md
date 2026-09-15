# התנ"ך למטייל (tanakh-lametayel)

מסך CMS לניהול תוכן אפליקציית **התנ"ך למטייל**: ערכי המדריך, מיקומי GPS,
תמונות ותרגומים. המסך נבנה בשלבים; מסמך זה מתעדכן עם כל שלב.

## איך זה עובד

- **פרויקט Firebase נפרד** מהתפילה: `koren-tanakh-lametayel`. פרויקט אחד
  בלבד, בלי סטייג'. כל שמירה ב-CMS היא טיוטה; משתמשי האפליקציה רואים רק
  מה שפורסם (שלב 7).
- **החיבור** נעשה כאפליקציית Firebase שלישית בשם `tanakh`
  (`src/firebase_config.ts`, `getTanakhFirebaseApp`), לצד סטייג' ופרוד של
  התפילה. ההגדרות מגיעות ממשתני סביבה `VITE_TLM_FIREBASE_*`.
- **כניסה.** בכניסה למסך מתבקשת סיסמה לפרויקט התנ"ך (אותו מייל כמו ב-CMS,
  סיסמה נפרדת), כמו הכניסה לפרוד במסך התפילות. הכניסה נשמרת עד לסגירת
  הטאב. הקוד ב-`src/views/tanakh/services/tanakhAuthService.ts`.
- **האפליקציה לא קוראת מ-Firestore.** היא מושכת קובץ תוכן אחד מ-Storage
  (`published/`), ולכן אין למשתמש האנונימי של האפליקציה גישה למסד בכלל.
- **קולקציות** (מוגדרות במלואן בשלב 2): `entries` – ערכי המדריך.

## הפעלה ראשונית (חד-פעמי)

### 1. בקונסולת Firebase (פרויקט `koren-tanakh-lametayel`)

1. **Firestore:** Create database → Standard edition → מזהה `(default)` →
   אזור `me-west1` (או `europe-west1`) → Production mode.
2. **Authentication:** Get started → Sign-in method → **Email/Password**.
   בלשונית Users להוסיף משתמש לכל עורך, עם אותו מייל שיש לו ב-CMS.
3. **Web app:** Project settings → Your apps → `</>` → שם `Koren CMS`, בלי
   Hosting. להעתיק את ערכי `firebaseConfig` (סעיף 2 להלן).
4. **Storage** (דורש תכנית Blaze עם חשבון חיוב): Get started → אותו אזור
   כמו Firestore. נדרש רק להעלאת תמונות ולפרסום (שלב 7); אפשר להשלים
   מאוחר יותר.
5. **חוקי אבטחה:** להדביק את `firebase/tanakh-lametayel/firestore.rules`
   ב-Firestore → Rules, ואת `firebase/tanakh-lametayel/storage.rules`
   ב-Storage → Rules (אחרי שהופעל).

### 2. משתני סביבה

ב-Vercel (Project → Settings → Environment Variables, לכל הסביבות), וב-
`.env.local` לפיתוח מקומי. הערכים מ-`firebaseConfig` של אפליקציית הווב:

```
VITE_TLM_FIREBASE_API_KEY=...
VITE_TLM_FIREBASE_AUTH_DOMAIN=koren-tanakh-lametayel.firebaseapp.com
VITE_TLM_FIREBASE_PROJECT_ID=koren-tanakh-lametayel
VITE_TLM_FIREBASE_STORAGE_BUCKET=koren-tanakh-lametayel.firebasestorage.app
VITE_TLM_FIREBASE_MESSAGING_SENDER_ID=...
VITE_TLM_FIREBASE_APP_ID=...
```

אלה הגדרות ציבוריות של אפליקציית ווב (לא סודות); הגישה נאכפת בחוקי
האבטחה. כשחסר משתנה, המסך מציג בדיוק מה חסר.

### 3. בדיקה

לפתוח את ה-CMS → "התנ"ך למטייל" → להזין סיסמה → המסך מציג "מחובר כ-…"
וספירת ערכים (0 לפני שלב 3). שגיאת קריאה אחרי כניסה מוצלחת = חוקי
האבטחה לא הודבקו.

## שלבים

| שלב | תוכן | מצב |
|---|---|---|
| 1 | תשתית: פרויקט, חיבור, כניסה, חוקים | הושלם בקוד; דורש הפעלה בקונסולה |
| 2 | מודל נתונים | |
| 3 | העברת התוכן הקיים (728 ערכים, 231 מיקומים) | |
| 4 | מסך העריכה: רשימה, טופס, מפה, תמונות, קטגוריות | |
| 5 | צנרת תרגום (Claude API) | |
| 6 | הזנה בעזרת בינה מלאכותית | |
| 7 | פרסום: קובץ תצוגה מקדימה וקובץ חי ב-Storage | |
| 8 | האפליקציה: משיכת הקובץ החדש, תמונות מרוחקות, אנגלית | |
