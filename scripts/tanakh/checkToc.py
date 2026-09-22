#!/usr/bin/env python3
"""השוואת תוכן העניינים המודפס של המדריך מול קובץ התוכן שפורסם לאפליקציה.

מדפיס, לכל נושא, את הערכים שבתוכן העניינים ואין להם ערך בקובץ התוכן, ואת
הערכים בקובץ התוכן שאינם בתוכן העניינים (בדרך כלל ערכי הפניה, וזה תקין).
ההשוואה מתעלמת מניקוד, מרווחים, פיסוק וכתיב מלא/חסר.

הרצה (מהמחשב, אחרי פרסום):
    python3 scripts/tanakh/checkToc.py ../Tanakh-LaMetayel/assets/content/pack.json
    python3 scripts/tanakh/checkToc.py pack.json --show-extra

הרקע: בקריאת ה-PDF המקורית נבלעו כמה כותרות ערכים לתוך הערך הקודם (עץ, עזה,
עכו, ארם נהרים, לוח העמים). הבדיקה הזו תופסת מקרה כזה מיד.
"""
import json, re, sys, unicodedata
from pathlib import Path

TOC = Path(__file__).with_name("toc") / "guide-toc.txt"


def clean(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    s = re.sub("[֑-ׇ]", "", s)          # ניקוד וטעמים
    s = re.sub(r"\(.*?\)", "", s)                  # הסברים בסוגריים: (עץ), (יישוב)
    s = re.sub(r"[\s\-־–—,:;.?!'\"’”״׳()\d]", "", s)  # רווחים, פיסוק וספרות
    return s.replace("ו", "").replace("י", "")     # כתיב מלא/חסר


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__); return 2
    pack = json.load(open(sys.argv[1], encoding="utf-8"))
    show_extra = "--show-extra" in sys.argv
    entries = pack["entries"]
    cats = {c["id"]: c["he"] for c in pack["categories"]}

    index: dict[int, dict[str, list]] = {}
    for e in entries:
        title = e.get("titleClean") or e["title"]
        variants = [title, title.replace("(", "").replace(")", "")] + re.split(r"[,:;]", title) + re.findall(r"\((.*?)\)", title)
        for part in variants:
            index.setdefault(e["cat"], {}).setdefault(clean(part), []).append(e)

    toc: dict[int, list[tuple[str, int]]] = {}
    for line in TOC.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#"):
            continue
        cat, title, page = line.split("|")
        toc.setdefault(int(cat), []).append((title, int(page)))

    problems = 0
    for cat, items in sorted(toc.items()):
        matched: set[str] = set()
        missing = []
        for title, page in items:
            hits = []
            for part in [title] + title.split(","):
                hits += index.get(cat, {}).get(clean(part), [])
            if hits:
                matched.update(h["id"] for h in hits)
            else:
                missing.append((title, page))
        in_app = [e for e in entries if e["cat"] == cat]
        extra = [e for e in in_app if e["id"] not in matched]
        print(f"== {cats.get(cat, cat)}: {len(items)} בתוכן העניינים, {len(in_app)} באפליקציה")
        for title, page in missing:
            print(f"   חסר: {title}  (עמ׳ {page})")
        problems += len(missing)
        if show_extra:
            for e in extra:
                print(f"   באפליקציה בלבד: {e['id']} {e.get('titleClean', e['title'])} (עמ׳ {e.get('page')})")
    print(f"\nסה״כ ערכים חסרים: {problems}")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
