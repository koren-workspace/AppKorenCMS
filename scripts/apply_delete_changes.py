"""
apply_delete_changes.py – ביצוע מחיקות פריטים דרך ממשק ה-CMS (לבדיקת פעולת המחיקה).

קורא קובץ JSON מ-generate_delete_candidates.py, מנווט לכל מקטע,
לוחץ "מחק מקטע" לכל פריט, מאשר את חלון האישור, ולוחץ "שמור מקטע".

דרוש: CMS רץ על http://localhost:5001
הרצה:
  python scripts/apply_delete_changes.py --deletes scripts/delete_candidates_YYYYMMDD_HHMMSS.json
  python scripts/apply_delete_changes.py --deletes scripts/delete_candidates_*.json --use-chrome --google-email "you@gmail.com"
"""

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

from playwright.sync_api import sync_playwright, Page, TimeoutError as PWTimeout

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from apply_changes import (
    CMS_URL,
    Logger,
    _derive_nusach_id,
    _check_server_running,
    _find_chrome_exe,
    _resolve_chrome_profile_directory,
    _prepare_chrome_session_clone,
    DEFAULT_CHROME_PROFILE,
    USER_DATA_DIR,
    CHROME_SESSION_DIR,
    NAV_TIMEOUT_MS,
    LOAD_TIMEOUT_MS,
    SAVE_TIMEOUT_MS,
    select_nusach,
    select_translation,
    select_category,
    select_prayer,
    select_part,
    navigate_to_part,
    _wait_for_items_load,
    save_part,
    group_changes,
)
from apply_attribute_changes import _find_item_card_with_scroll

DELETE_BTN_TEXT = "מחק מקטע"


def _find_item_card_for_delete(page: Page, item_id: str, logger: Logger):
    """מחפש כרטיס פריט (עם גלילה); מחזיר Locator או None."""
    return _find_item_card_with_scroll(page, item_id, logger)


def apply_one_delete(page: Page, item_id: str, logger: Logger) -> bool:
    """
    מסמן פריט אחד למחיקה: מוצא כרטיס, לוחץ "מחק מקטע", מאשר את ה-confirm.
    מחזיר True אם הצליח, False אם הפריט לא נמצא (מדלגים).
    """
    card = _find_item_card_for_delete(page, item_id, logger)
    if card is None:
        logger.log(f"  פריט {item_id} – לא נמצא ב-DOM – מדלג")
        return False

    card.scroll_into_view_if_needed()
    time.sleep(0.2)

    delete_btn = card.get_by_role("button", name=DELETE_BTN_TEXT).first
    try:
        delete_btn.wait_for(state="visible", timeout=NAV_TIMEOUT_MS)
    except PWTimeout:
        logger.log(f"  פריט {item_id} – כפתור '{DELETE_BTN_TEXT}' לא נמצא – מדלג")
        return False

    # לחיצה על "מחק מקטע" מפעילה window.confirm – מאשרים אוטומטית
    page.once("dialog", lambda d: d.accept())
    delete_btn.click()
    time.sleep(0.3)
    logger.log(f"  [OK] פריט {item_id} – סומן למחיקה")
    return True


def apply_all_deletes(page: Page, deletes: list[dict], logger: Logger) -> dict:
    """מבצע את כל המחיקות לפי קובץ ה-JSON."""
    # group_changes מצפה לרשומה עם nusachId, translationId, categoryName, prayerId, partId, partName, itemId
    groups = group_changes(deletes)
    current_nav = {}
    stats = {"success": 0, "failed": 0, "skipped": 0}

    for (nusach_id, translation_id, category_name, prayer_id, part_id), group_data in groups.items():
        category_name = group_data["categoryName"]
        prayer_name = group_data["prayerName"]
        part_name = group_data["partName"]
        items = group_data["items"]

        logger.log(
            f"\nקבוצה: {nusach_id} / {translation_id} / "
            f"קטגוריה={category_name or '-'} / תפילה={prayer_name or prayer_id} / מקטע={part_name or part_id}"
        )

        try:
            navigate_to_part(
                page, nusach_id, translation_id, category_name, prayer_name, part_name, logger, current_nav
            )
        except RuntimeError as e:
            logger.log(f"  [שגיאת ניווט] {e}")
            stats["failed"] += len(items)
            continue

        page.evaluate("window.scrollTo(0, 0)")
        time.sleep(0.3)

        for rec in items:
            item_id = rec["itemId"]
            try:
                if apply_one_delete(page, item_id, logger):
                    stats["success"] += 1
                else:
                    stats["skipped"] += 1
            except Exception as e:
                logger.log(f"  [שגיאה] item {item_id}: {e}")
                stats["failed"] += 1

        try:
            save_part(page, logger)
        except Exception as e:
            logger.log(f"  [שגיאת שמירה] {e}")

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="מבצע מחיקות פריטים ב-CMS לפי קובץ JSON")
    parser.add_argument(
        "--deletes",
        type=Path,
        required=True,
        help="נתיב לקובץ JSON (מ-generate_delete_candidates.py)",
    )
    parser.add_argument("--login", action="store_true", help="פתח דפדפן לכניסה ידנית")
    parser.add_argument(
        "--use-chrome",
        nargs="?",
        const="auto",
        metavar="PROFILE_PATH",
        help="השתמש בפרופיל Chrome (--use-chrome או --use-chrome \"C:\\...\\User Data\")",
    )
    parser.add_argument("--chrome-profile-directory", help="שם תיקיית פרופיל Chrome")
    parser.add_argument("--google-email", help="Gmail לחיפוש פרופיל Chrome")
    args = parser.parse_args()

    if not args.deletes.exists():
        sys.exit(f"שגיאה: קובץ לא נמצא: {args.deletes}")

    with open(args.deletes, encoding="utf-8") as f:
        data = json.load(f)

    deletes = data.get("deletes", [])
    if not deletes:
        print("אין פריטים למחיקה בקובץ.")
        return

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = SCRIPT_DIR / f"apply_delete_log_{timestamp_str}.txt"
    logger = Logger(log_path)

    logger.log(f"קובץ: {args.deletes}")
    logger.log(f"סה\"כ פריטים למחיקה: {len(deletes)}")
    logger.log(f"לוג: {log_path}")

    _check_server_running(logger)

    if args.use_chrome:
        chrome_src = Path(args.use_chrome) if args.use_chrome != "auto" else DEFAULT_CHROME_PROFILE
        if not chrome_src.exists():
            logger.log(f"שגיאה: תיקיית Chrome לא נמצאה: {chrome_src}")
            sys.exit(1)
        chrome_exe = _find_chrome_exe()
        if not chrome_exe:
            logger.log("שגיאה: לא נמצא Chrome.")
            sys.exit(1)
        logger.log(f"משתמש בפרופיל Chrome: {chrome_src}")
        try:
            chrome_profile_directory = _resolve_chrome_profile_directory(
                chrome_src, args.chrome_profile_directory, args.google_email, logger
            )
        except RuntimeError as e:
            logger.log(f"שגיאה: {e}")
            sys.exit(1)
        if not chrome_profile_directory:
            chrome_profile_directory = "Default"
        logger.log("סוגר תהליכי Chrome קיימים...")
        subprocess.run(["taskkill", "/F", "/IM", "chrome.exe"], capture_output=True)
        time.sleep(2)
        try:
            chrome_runtime_dir, chrome_runtime_profile = _prepare_chrome_session_clone(
                chrome_src, chrome_profile_directory, logger
            )
        except Exception as e:
            logger.log(f"שגיאה בהכנת סשן Chrome: {e}")
            sys.exit(1)
        context_args = dict(
            user_data_dir=str(chrome_runtime_dir),
            executable_path=str(chrome_exe),
            headless=False,
            slow_mo=80,
            args=[
                f"--profile-directory={chrome_runtime_profile}",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-sync",
                "--restore-last-session",
                "--disable-blink-features=AutomationControlled",
            ],
        )
    else:
        USER_DATA_DIR.mkdir(exist_ok=True)
        context_args = dict(
            user_data_dir=str(USER_DATA_DIR),
            headless=False,
            slow_mo=80,
            args=["--disable-blink-features=AutomationControlled"],
        )

    with sync_playwright() as pw:
        try:
            browser = pw.chromium.launch_persistent_context(**context_args)
        except Exception as e:
            logger.log(f"שגיאה בפתיחת הדפדפן: {e}")
            sys.exit(1)

        page = browser.pages[0] if browser.pages else browser.new_page()
        time.sleep(1)
        logger.log(f"מנווט ל-{CMS_URL}")
        page.goto(CMS_URL, wait_until="domcontentloaded", timeout=30_000)
        try:
            page.wait_for_selector("body", timeout=10_000)
        except PWTimeout:
            pass
        time.sleep(10)

        sign_in_btn = page.locator("button:has-text('Sign in'), a:has-text('Sign in')").first
        if sign_in_btn.count() > 0 or args.login:
            logger.log("נדרשת כניסה – ממתין להתחברות ידנית")
            print("\n" + "=" * 55)
            print("  הדפדפן נפתח – התחברי עם חשבון Google של קורן.")
            print("  לאחר שנכנסת ל-CMS, חזרי לכאן ולחצי Enter.")
            print("=" * 55)
            input("  לחצי Enter להמשך... ")
            time.sleep(2)

        stats = apply_all_deletes(page, deletes, logger)
        logger.log(
            f"\nסיכום: הצלחות={stats['success']}, שגיאות={stats['failed']}, דילוג={stats['skipped']}"
        )

        if browser:
            browser.close()

    print(f"\nלוג נשמר: {log_path}")


if __name__ == "__main__":
    main()
