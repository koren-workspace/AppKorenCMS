# גיבוי ושחזור Firebase (Firestore) — מה מוגדר ואיך משחזרים

מסמך זה מתעד את מנגנוני הגיבוי שהופעלו על מסדי הנתונים של Firestore,
ואת תהליכי השחזור למקרה חירום.

**הוגדר בתאריך:** 19.08.2026, דרך קונסולת Firebase (מסך Firestore → Disaster recovery),
על ידי חשבון Owner.

## על אילו פרויקטים זה חל

| סביבה | פרויקט Firebase | הערות |
|---|---|---|
| Prod | `koren-c51c8` | ממנו האפליקציות קוראות (deltas) |
| Stage | Koren-stage | סביבת העבודה של ה-CMS |

בשני הפרויקטים ההגדרה זהה, על מסד הנתונים `(default)`.

## מה מוגדר

### 1. Point-in-time recovery (PITR) — חזרה אחורה בזמן

- **מה זה נותן:** אפשר לקרוא ולשחזר את הנתונים כפי שהיו בכל רגע
  (רזולוציה של דקה) **עד 7 ימים אחורה**.
- **סטטוס:** מופעל בשני הפרויקטים. ההיסטוריה נצברת החל מ-19.08.2026 בערב.
- **למה זה טוב:** מחיקה בטעות, עריכה שגויה, או טעינה שהרסה נתונים —
  שהתגלו תוך שבוע.

### 2. Scheduled backups — גיבוי שבועי אוטומטי

- **מה זה נותן:** כל **יום שני** נוצר אוטומטית גיבוי מלא של מסד הנתונים,
  וכל גיבוי נשמר **98 ימים (14 שבועות)**.
- **סטטוס:** מוגדר בשני הפרויקטים (Weekly, Monday, retention 98 days).
  גיבוי יומי לא הוגדר — ה-PITR מכסה את הטווח הקצר.
- **למה זה טוב:** בעיה שהתגלתה באיחור של יותר משבוע — יש נקודת שחזור
  שבועית עד ~3 חודשים אחורה.

### עלות

משלמים רק על אחסון הגיבויים וההיסטוריה. בהיקפי הטקסט של הפרויקט מדובר
בסכומים זניחים (סנטים בודדים בחודש). שני הפרויקטים על תוכנית Blaze — תנאי
מקדים לשתי היכולות.

## איך מוודאים שהכל תקין

בקונסולת Firebase: בחירת פרויקט → **Firestore Database** → לשונית
**Disaster recovery**:

- המתג Point-in-time recovery דלוק, ו-"Earliest version time" מציג תאריך
  (עד 7 ימים אחורה).
- תחת Scheduled backups: `Weekly backups retention: Monday for 98 days`.
- כפתור **View all backups** מציג את הגיבויים שנוצרו בפועל
  (הראשון — יום שני שאחרי 19.08.2026).

או בשורת פקודה (gcloud, עם חשבון מורשה):

```bash
gcloud firestore databases describe --database='(default)' --project=koren-c51c8
# מצפים לראות: pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED

gcloud firestore backups schedules list --database='(default)' --project=koren-c51c8
gcloud firestore backups list --project=koren-c51c8
```

(ולהריץ שוב עם מזהה פרויקט ה-Stage.)

## איך משחזרים

> ⚠️ שחזור הוא פעולה רגישה. מומלץ לא לבצע לבד בפעם הראשונה — לערב את מי
> שמלווה את התשתית. שני המסלולים **לא דורסים** את מסד הנתונים הקיים:
> השחזור נכנס למסד נתונים חדש, ומשם מחליטים איך להחזיר את הנתונים פנימה.

### מסלול א': הבעיה קרתה בשבוע האחרון → PITR

משכפלים את מסד הנתונים כפי שהיה ברגע נתון למסד חדש:

```bash
gcloud firestore databases clone \
  --source-database='projects/koren-c51c8/databases/(default)' \
  --snapshot-time='2026-08-18T20:00:00Z' \
  --destination-database='restore-2026-08-18' \
  --project=koren-c51c8
```

- `snapshot-time` הוא הרגע שאליו רוצים לחזור, ב-UTC (שעון ישראל בקיץ = UTC+3).
- חלופה אם `clone` לא זמין בגרסת ה-gcloud: ייצוא snapshot ל-Cloud Storage
  וייבוא חזרה —
  `gcloud firestore export gs://BUCKET/pitr --snapshot-time='...'` ואז
  `gcloud firestore import gs://BUCKET/pitr`.

### מסלול ב': הבעיה ישנה יותר → שחזור מגיבוי שבועי

```bash
# 1. מאתרים את הגיבוי הרצוי (לפי תאריך)
gcloud firestore backups list --project=koren-c51c8

# 2. משחזרים אותו למסד נתונים חדש
gcloud firestore databases restore \
  --source-backup='projects/koren-c51c8/locations/LOCATION/backups/BACKUP_ID' \
  --destination-database='restore-from-backup' \
  --project=koren-c51c8
```

### אחרי השחזור — החזרת הנתונים למסד הראשי

מסד הנתונים המשוחזר הוא עותק צד. משם יש שתי אפשרויות:

1. **שחזור נקודתי (המומלץ):** להעתיק מהעותק המשוחזר רק את המסמכים/האוספים
   שנפגעו חזרה אל `(default)` (בסקריפט קטן עם firebase-admin, שכבר קיים
   כתלות בפרויקט).
2. **שחזור מלא:** ייצוא של המסד המשוחזר וייבוא (import) לתוך `(default)`.
   שימו לב: import מעדכן/מוסיף מסמכים אך **לא מוחק** מסמכים שנוצרו אחרי
   נקודת השחזור — אם נדרש שחזור "נקי" מוחלט, מתייעצים לפני.

בסיום — למחוק את מסד הנתונים הזמני כדי לא לשלם על אחסונו:

```bash
gcloud firestore databases delete --database='restore-2026-08-18' --project=koren-c51c8
```

## מה זה לא מכסה

- **BagelDB** — התוכן המפורסם לאפליקציות יושב גם ב-Bagel. גיבויי Firebase
  לא נוגעים בו; במקרה הצורך אפשר לפרסם מחדש מה-CMS אל Bagel אחרי שחזור
  Firestore.
- **עותק מחוץ לגוגל** (דרופבוקס וכד') — הגיבויים נשמרים אצל גוגל באותו
  פרויקט. הגנה מפני אובדן חשבון הגוגל עצמו דורשת פיתוח נפרד (ייצוא שבועי
  חיצוני) — טרם הוחלט אם לממש.
- **Firebase Authentication** (משתמשים) ו-**Storage** (קבצים) — הגיבוי חל על
  Firestore בלבד. משתמשים ניתן לייצא ידנית עם `firebase auth:export` במקרה
  הצורך.
