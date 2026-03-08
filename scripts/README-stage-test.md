# בדיקות STAGE – מה צריך לעשות

ה-CMS כבר מחובר ל-Firebase STAGE (koren-stage). הסקריפטים כאן רצים **מחוץ ל-CMS** (מהטרמינל), ולכן הם צריכים **הרשאה נפרדת** – קובץ Service Account ומשתנה סביבה. בלי זה אי אפשר להריץ את הבדיקות.

---

## מה לעשות – לפי סדר

### שלב 1: קובץ הרשאות (Service Account)

1. היכנס ל-[Firebase Console](https://console.firebase.google.com/) ובחר את הפרויקט **koren-stage**.
2. צד שמאל: **Project settings** (גלגל השיניים) → **Service accounts**.
3. לחץ **Generate new private key** (אישור ב-Download).
4. קובץ JSON יורד. העבר אותו לתיקיית הפרויקט, למשל:
   ```
   AppKorenCMS/scripts/koren-stage-sa.json
   ```
   (אל תעלה את הקובץ ל-git – הוא מכיל סוד.)

### שלב 2: משתנה סביבה (חובה)

הסקריפטים רצים ב-Node ולא דרך הדפדפן, אז הם לא משתמשים בהתחברות של ה-CMS. הם צריכים לדעת **איפה קובץ ה-Service Account**.

**ב-PowerShell (להרצה אחת):**
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\Users\conferenceroom\Desktop\CMS\AppKorenCMS\scripts\koren-stage-sa.json"
```
(החלף בנתיב האמיתי לקובץ אצלך.)

**ב-PowerShell (קבוע למשך הסשן):**  
אותו שורה לפני שהרצת `npm run stage-test` או `npm run stage-revert`.

**ב-CMD:**
```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\conferenceroom\Desktop\CMS\AppKorenCMS\scripts\koren-stage-sa.json
```

אם לא מגדירים את המשתנה – הסקריפטים יודיעו שחסר `GOOGLE_APPLICATION_CREDENTIALS` וייצאו.

### שלב 3: קובץ תצורה

1. בתיקייה `scripts/` העתק את הקובץ:
   - `stage-test-config.example.json` → `stage-test-config.json`
2. פתח את `stage-test-config.json` וערוך לפי הנתונים ב-STAGE:
   - **translationId** – מזהה התרגום (למשל `0-ashkenaz`)
   - **prayerId** – מזהה התפילה (למשל `1`)
   - **partId** – מזהה המקטע (למשל `1`)

אפשר לראות את הערכים האלה ב-CMS כשנכנסים לנוסח, תרגום, תפילה ומקטע.

### שלב 4: הרצת הבדיקות

מהשורש של הפרויקט (`AppKorenCMS`):

**א. בדיקה פשוטה (חיבור + שינוי אחד)**  
```bash
npm run stage-test
```  
טוען פריטים, שומר גיבוי, משנה את הפריט הראשון (מוסיף ` [STAGE_TEST]` ל-content), מאמת ב-Firestore. אחרי זה צריך להריץ `npm run stage-revert` כדי להחזיר.

**ב. סוויטה מלאה מול Firebase**  
אפשר להריץ את שתי הקטגוריות יחד או כל אחת בנפרד:

| פקודה | מה מריץ |
|--------|---------|
| `npm run stage-test-suite` | שתי הקטגוריות (1 ואז 2) |
| `npm run stage-test-suite-1` | **רק קטגוריה 1** – תוכן ומבנה |
| `npm run stage-test-suite-2` | **רק קטגוריה 2** – עומס |

- **קטגוריה 1:** שינוי אטומי (אות), שינוי טקסט (מחרוזת), שינוי שדה מבני (type), מחיקה רכה (deleted) ואימות שהפריט לא מוחזר עד שמבטלים.
- **קטגוריה 2:** 1, 5, 20 ו-100 עדכונים במקביל (אימות שכל השינויים נשמרו). אם במקטע יש פחות מ-100 פריטים – הבדיקה של 100 תדולג.

אחרי כל בדיקה הסקריפט מחזיר את הפריטים למצב הגיבוי, ובסוף מבצע החזרה מלאה ומוחק את קובץ הגיבוי.

### שלב 5: החזרת המצב (רק אחרי `stage-test`)

אם הרצת רק `npm run stage-test` (לא את הסוויטה), להחזיר את המקטע:

```bash
npm run stage-revert
```

הסקריפט מחזיר את כל הפריטים מהגיבוי ומוחק את קובץ הגיבוי. אחרי `stage-test-suite` **אין צורך** ב-revert – הסוויטה מחזירה בעצמה.

---

## סיכום – רשימת פעולות

| # | פעולה |
|---|--------|
| 1 | להוריד Service Account מ-Firebase (koren-stage) ולשמור כ-JSON בתיקיית `scripts/`. |
| 2 | להגדיר משתנה סביבה `GOOGLE_APPLICATION_CREDENTIALS` לנתיב המלא לקובץ ה-JSON. |
| 3 | להעתיק `stage-test-config.example.json` ל-`stage-test-config.json` ולמלא `translationId`, `prayerId`, `partId`. |
| 4 | להריץ `npm run stage-test-suite` (שתי הקטגוריות), או `npm run stage-test-suite-1` (רק קטגוריה 1), או `npm run stage-test-suite-2` (רק קטגוריה 2), או `npm run stage-test` (בדיקה פשוטה). |
| 5 | אם הרצת רק `stage-test` – להריץ `npm run stage-revert` כדי להחזיר. אחרי הסוויטות אין צורך. |

---

## הערות

- **משתנה סביבה** – צריך להגדיר **בכל טרמינל/סשן** חדש (או להגדיר אותו בהתקנה אחת במערכת אם יודעים איך).
- קובץ הגיבוי `.stage-test-backup.json` נוצר רק אחרי הרצת `stage-test` ולא עולה ל-git.
- `stage-test-config.json` לא עולה ל-git – כל מפתח עובד עם התצורה שלו.
