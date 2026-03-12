# סיכום מלא: חישובים ושימושים ב־MITID

## 1. מהו mit_id

**mit_id** הוא שדה **מזהה מיון** (מחרוזת עם ערך מספרי) בפריטי מקטע (items) במערכת. הוא קובע את **סדר הפריטים** בתוך מקטע. המיון מתבצע **numerically** (מספרית) כדי לתמוך בערכים עשרוניים (למשל 10, 10.5, 11) ולהכנסות "בין" שני פריטים בלי לשנות את כל ה־IDs.

---

## 2. קריאות לחישוב (איפה מחשבים ערך מיון חדש)

המערכת קוראת לפונקציית החישוב (ב־`itemUtils.ts`) רק במקומות הבאים. הלוגיקה הפנימית של החישוב אינה מתוארת כאן.

| קובץ | פונקציה / הקשר | מתי נקרא | שימוש בתוצאה |
|------|-----------------|----------|----------------|
| **usePartEdit.ts** | `computeMitIdForIndex(index)` | הוספת פריט/הוראה חדש במקטע (כפתור "הוסף מקטע כאן" וכו') | התוצאה נשמרת כ־**mit_id** של הפריט החדש. נקרא מ־`doAddNewItemAt` ו־`doAddNewInstructionAt`. |
| **usePartEdit.ts** | `computeItemIdForIndex(index, …)` | אותו אירוע (הוספת פריט במקטע) | התוצאה נשמרת כ־**itemId** של הפריט החדש (לא mit_id). |
| **partEditService.ts** | `createTranslationItem(…)` | הוספת תרגום לפריט (create translation) | קריאה ראשונה → **newMitId** (נשמר ב־`mit_id`). קריאה שנייה → **newItemId** (נשמר ב־`itemId`). |
| **partEditService.ts** | `moveItemsToPart(…)` | העברת פריטים למקטע אחר | בלולאה: לכל פריט מועבר קוראים לחישוב; התוצאה נשמרת כ־**mit_id** של הפריט במקטע היעד (וגם לפריטי תרגום מקושרים). |

**פרטים קצרים לכל קריאה:**

- **computeMitIdForIndex:** מחשב `idBefore` ו־`idAfter` מהשכנים ב־`allItems`, `baseItems` ו־`neighborBounds`, קורא לחישוב, ואז בודק ייחודיות מול `takenMitIds` (כולל מחוקים) – אם תפוס מעלה ב־0.5.
- **computeItemIdForIndex:** אותו רעיון עבור itemId; בודק ייחודיות מול `takenItemIds` (כולל enhancements ו־deleted).
- **createTranslationItem:** קובע `idBefore`/`idAfter` לפי מיקום ההכנסה במקטע היעד (או "בהתחלה"); קורא לחישוב עבור mit_id ועבור itemId; בודק ייחודיות מול `existingIds` במקטע היעד.
- **moveItemsToPart:** קובע `idBefore`/`idAfter` לפי `insertAfterItemId` במקטע היעד; לכל פריט ברצף קורא לחישוב עם `prevMitId` ו־`idAfter`, ומעדכן `prevMitId` לתוצאה.

---

## 3. שימושים ב־CMS

### 3.1 טעינת מקטע ומיון

**מיקום:** `partEditService.ts` – `fetchPartWithEnhancements`, `fetchPartItems`

- פריטי מקטע נטענים מ־Firestore (filter לפי `partId`).
- **מיון:** `(a.values?.mit_id || "").localeCompare(b.values?.mit_id || "", undefined, { numeric: true })`.
- פריטים עם `deleted: true` לא מוצגים; ה־`mit_id` שלהם נאסף ל־**deletedMitIds** (משמש בחישוב mit_id לפריטים חדשים כדי לא להקצות שוב אותו ערך).
- `fetchPartItems` – טוען פריטי מקטע של תרגום אחד, **ממוינים לפי mit_id** (אותה `localeCompare` עם `numeric: true`).

### 3.2 גבולות שכנים (neighborBounds)

**מיקום:** `usePartEdit.ts`

- **משתנה:** `neighborBounds`: `{ prevLastItemId?, prevLastMitId?, nextFirstItemId?, nextFirstMitId? }`.
- נטען ב־`fetchItemsWithEnhancements`: מחשבים פריטים מהמקטע **הקודם** ו**הבא** (לפי סדר המקטעים):
  - **prevLastMitId** = `mit_id` (או `itemId`) של הפריט האחרון במקטע הקודם.
  - **nextFirstMitId** = `mit_id` (או `itemId`) של הפריט הראשון במקטע הבא.
- משמש כשהמקטע **ריק** או כשמוסיפים פריט **בהתחלה/בסוף** הרשימה (אין שכנים בתוך המקטע).

### 3.3 פונקציות עזר ב־usePartEdit (חישוב mit_id במסך עריכה)

**מיקום:** `usePartEdit.ts`

| פונקציה | תפקיד |
|--------|--------|
| **getEffectiveMitId(item)** | מחזיר את ה־mit_id האפקטיבי: קודם מ־`localValues[item.id].mit_id`, אחרת מ־`item.values.mit_id`. |
| **getMitIdForPosition(item)** | בעריכת **תרגום** עם baseItems: אם לפריט יש `linkedItem` לבסיס – מחזיר את ה־mit_id של פריט הבסיס; אחרת את ה־mit_id של הפריט עצמו. |
| **getNextBaseMitIdAfter(baseMitId)** | מחזיר את ה־mit_id של פריט הבסיס **הבא** אחרי הערך המספרי של baseMitId (לפי סדר baseItems). |
| **maxMitId(a, b)** | השוואה מספרית – מחזיר את המחרוזת עם הערך **הגבוה** יותר. |
| **minMitId(a, b)** | השוואה מספרית – מחזיר את המחרוזת עם הערך **הנמוך** יותר. |

### 3.4 חישוב mit_id לפריט חדש במיקום (computeMitIdForIndex)

**מיקום:** `usePartEdit.ts` – `computeMitIdForIndex(index)`

**מטרה:** לתת mit_id לפריט **חדש** שמוכנס במיקום `index`, תוך התחשבות בתרגום ו־בסיס (base).

**קריאה:** מחשב `idBefore` ו־`idAfter` (מהשכנים ב־allItems, baseItems, neighborBounds), קורא לפונקציית החישוב, ובודק ייחודיות מול `takenMitIds` (כולל deleted ו־pendingDeletes) – אם תפוס מעלה ב־0.5.

**שימוש:** ב־**doAddNewItemAt** ו־**doAddNewInstructionAt** – בעת הוספת פריט/הוראה חדש: `mit_id: computeMitIdForIndex(index)`.

### 3.5 יצירת פריט תרגום חדש (createTranslationItem)

**מיקום:** `partEditService.ts` – `createTranslationItem`

- טוען את כל פריטי המקטע היעד (`fetchPartItems`), ממוינים לפי mit_id.
- מחשב **idBefore** ו־**idAfter** לפי מיקום ההכנסה (afterItemId ריק = בהתחלה; אחרת אחרי הפריט המסומן).
- **קריאה לחישוב** מחזירה **newMitId** ו־**newItemId**; הפריט נשמר עם `mit_id: newMitId` ו־`itemId: newItemId`. בודק ייחודיות מול existingIds במקטע היעד.

### 3.6 העברת פריטים למקטע אחר (moveItemsToPart)

**מיקום:** `partEditService.ts` – `moveItemsToPart`

- פריטים מועברים ממוינים לפי **mit_id** הנוכחי (שמירת הסדר הפנימי).
- מחשבים **idBefore** ו־**idAfter** במקטע היעד לפי `insertAfterItemId`.
- **קריאה לחישוב** לכל פריט **ברצף**: עם `prevMitId` ו־`idAfter`; התוצאה נשמרת כ־mit_id של הפריט, ו־prevMitId מתעדכן לתוצאה. כל פריט (כולל תרגומים מקושרים) מתעדכן ל־mit_id החדש.

### 3.7 שמירת מקטע (savePartItems)

**מיקום:** `partEditService.ts` – `savePartItems`

- שומר את הערכים מ־`localValues` (כולל `mit_id`) לפריטים ב־`changedIds`.
- **לא** מחשב מחדש mit_id לפי סדר – מה שנשמר בעריכה (כולל mit_id שהוקצה ב־computeMitIdForIndex או שנשאר מהשרת) נשמר-is.

### 3.8 מחיקה (deleted) והשפעה על mit_id

- פריטים עם `deleted: true` לא מוצגים ברשימה.
- ה־mit_id שלהם נשמר ב־**deletedIdsFromServer.mitIds** ומוכנס ל־**takenMitIds** ב־computeMitIdForIndex – כך שלא יוקצה אותו mit_id לפריט חדש.

### 3.9 לוג שינויים (Changelog) ודוחות

- ב־**appendChangeLog** אחרי createTranslationItem נשמרים `newItemId` ו־**newMitId**.
- ב־**cms-changelog.json** מופיע שדה `mit_id` בעדכוני שינויים (למשל בעדכון ערך ל־"101001611030").

---

## 4. סקריפט apply_changes.py

**מיקום:** `AppKorenCMS/scripts/apply_changes.py`

- **דוח Excel:** כותרת כוללת עמודה **"mit_id"**; בכל שורה: `row_data.get("mit_id", row_data.get("itemId", ""))`.
- **שורות דוח (report_rows):** לכל שינוי נשמר גם `"mit_id": change.get("mit_id", item_id)` – כלומר mit_id מהשינוי, או fallback ל־itemId.
- הסקריפט מנווט ב־CMS ומוסיף/מעדכן תוכן לפי itemId; ה־mit_id משמש **לזיהוי ולדיווח** בשורות הדוח, לא לחישוב מחדש של סדר.

---

## 5. האפליקציה (Android)

- בחיפוש ב־**workspace** של האפליקציה (2000apps-koren-android) **לא נמצא** קוד שמשתמש או מחשב **mit_id**.
- הפרויקט מפנה לתיקיית ה־CMS; הלוגיקה של mit_id מוגדרת **רק ב־CMS**.
- באפליקציה הנתונים כנראה מגיעים מ־Firestore/Bagel **כבר ממוינים** (למשל לפי mit_id בצד השרת/סנכרון), והאפליקציה מציגה/משתמשת בסדר הזה בלי להגדיר שדה mit_id בעצמה.

---

## 6. סיכום טבלאי – איפה mit_id מופיע

| מקום | שימוש / חישוב |
|------|----------------|
| **itemUtils.ts** | פונקציית החישוב (קריאות אליה – ראה סעיף 2). |
| **partEditService – fetchPartWithEnhancements** | מיון לפי mit_id; איסוף deletedMitIds. |
| **partEditService – fetchPartItems** | מיון פריטי מקטע לפי mit_id. |
| **partEditService – createTranslationItem** | קריאה לחישוב → newMitId; שמירה עם mit_id (ו־itemId). |
| **partEditService – moveItemsToPart** | קריאה לחישוב לכל פריט מועבר ברצף; עדכון mit_id לפריטים + תרגומים מקושרים. |
| **usePartEdit – neighborBounds** | prevLastMitId, nextFirstMitId – גבולות למקטע ריק או לקצוות. |
| **usePartEdit – deletedIdsFromServer** | mitIds – מונעים הקצאת אותו mit_id לפריט חדש. |
| **usePartEdit – getEffectiveMitId, getMitIdForPosition** | mit_id אפקטיבי ומיקום (כולל קישור לבסיס). |
| **usePartEdit – getNextBaseMitIdAfter, maxMitId, minMitId** | עזרים לחישוב גבולות בתרגום+בסיס. |
| **usePartEdit – computeMitIdForIndex** | חישוב mit_id לפריט חדש במיקום index (כולל ייחודיות מול takenMitIds). |
| **usePartEdit – doAddNewItemAt / doAddNewInstructionAt** | mit_id: computeMitIdForIndex(index). |
| **usePartEdit – createTranslationItem (קריאה)** | מקבל newMitId ומשתמש ב־appendChangeLog. |
| **savePartItems** | שומר את ה־mit_id שנמצא ב־localValues (ללא חישוב מחדש). |
| **apply_changes.py** | עמודת mit_id בדוח Excel; שדה mit_id בשורות הדוח. |
| **cms-changelog.json** | רישום שינויים שכוללים שדה mit_id. |
| **אפליקציה (Android)** | אין שימוש או חישוב mit_id בקוד שנבדק; הסדר מגיע מהמערכת/סנכרון. |

---

*נוצר לפי קוד ה־CMS והאפליקציה בתאריך הסיכום.*
