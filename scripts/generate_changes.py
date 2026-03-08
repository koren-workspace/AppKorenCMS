"""
generate_changes.py – ייצור JSON של שינויים עתידיים בפריטי תפילה ב-Firestore.

הסקריפט קורא פריטים (items) מ-Firestore לפי הscope שב-config,
מחשב עבור כל פריט מה יהיה ערך השדה אחרי הפעלת החוקים (rules),
ומייצר קובץ JSON הכולל לכל פריט שישתנה: ערך לפני ואחרי.

ה-JSON מיועד לשימוש על ידי סקריפט ביצוע (apply_changes.py) שיבצע
את השינויים דרך ממשק ה-CMS.

מאתר אוטומטית קובץ service account בתיקיית scripts/ (ללא הגדרה ידנית).

הרצה:
  python scripts/generate_changes.py
  python scripts/generate_changes.py --config scripts/my_config.json
"""

import argparse
import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

import requests as http_requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG = SCRIPT_DIR / "changes_config.json"
FIRESTORE_BASE = "https://firestore.googleapis.com/v1"
SCOPES = ["https://www.googleapis.com/auth/datastore"]


def derive_nusach_id(translation_id: str) -> str:
    """מפיק nusachId מתוך translationId, למשל 0-ashkenaz -> ashkenaz."""
    if "-" not in translation_id:
        return translation_id
    return translation_id.split("-", 1)[1]


# ---------------------------------------------------------------------------
# חיפוש קובץ service account
# ---------------------------------------------------------------------------

def _is_service_account(path: Path) -> bool:
    """בודק אם הקובץ הוא service account תקין."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return data.get("type") == "service_account" and "client_email" in data
    except Exception:
        return False


def _is_google_services(path: Path) -> bool:
    """בודק אם הקובץ הוא google-services.json (לא service account)."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return "project_info" in data and "client" in data
    except Exception:
        return False


def find_service_account(project_id: str, explicit_path: str | None) -> Path:
    """
    מאתר קובץ service account לפי סדר עדיפויות:
    1. credentials_path מה-config (אם צוין)
    2. חיפוש אוטומטי בתיקיית scripts/
    """
    candidates: list[Path] = []

    if explicit_path:
        candidates += [
            Path(explicit_path),
            SCRIPT_DIR.parent / explicit_path,
            SCRIPT_DIR / Path(explicit_path).name,
        ]

    candidates += sorted(SCRIPT_DIR.glob(f"{project_id}*.json"))
    candidates += sorted(SCRIPT_DIR.glob("*adminsdk*.json"))
    candidates += sorted(SCRIPT_DIR.glob("*-sa.json"))

    for path in candidates:
        if path.exists() and _is_service_account(path):
            return path

    wrong = [p.name for p in SCRIPT_DIR.glob("*.json") if p.exists() and _is_google_services(p)]
    extra = f"\n  (הקבצים {', '.join(wrong)} הם קבצי Android config – לא service account)" if wrong else ""

    sys.exit(
        f"שגיאה: לא נמצא קובץ service account בתיקיית scripts/.{extra}\n\n"
        "כיצד לקבל:\n"
        f"  1. פתח: https://console.firebase.google.com/project/{project_id}"
        "/settings/serviceaccounts/adminsdk\n"
        "  2. לחץ 'Generate new private key'\n"
        "  3. שמור את הקובץ שהורד בתיקייה scripts/\n"
    )


# ---------------------------------------------------------------------------
# Firestore REST client (ללא gRPC – עובד על Windows ללא בעיות SSL)
# ---------------------------------------------------------------------------

class FirestoreClient:
    def __init__(self, project_id: str, sa_path: Path):
        self.project_id = project_id
        self._db_prefix = f"projects/{project_id}/databases/(default)/documents"
        self._creds = service_account.Credentials.from_service_account_file(
            str(sa_path), scopes=SCOPES
        )
        self._session = http_requests.Session()
        self._refresh()

    def _refresh(self) -> None:
        if not self._creds.valid:
            self._creds.refresh(Request(session=self._session))
        self._session.headers["Authorization"] = f"Bearer {self._creds.token}"

    def _ensure_token(self) -> None:
        if not self._creds.valid or (
            self._creds.expiry and self._creds.expiry - datetime.utcnow() < timedelta(minutes=2)
        ):
            self._refresh()

    def get_document(self, doc_path: str) -> dict | None:
        """שליפת מסמך בודד. מחזיר None אם לא קיים."""
        self._ensure_token()
        url = f"{FIRESTORE_BASE}/{self._db_prefix}/{doc_path}"
        resp = self._session.get(url)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()

    def list_collection(self, collection_path: str) -> list[dict]:
        """שליפת כל המסמכים ב-collection (עם pagination)."""
        self._ensure_token()
        url = f"{FIRESTORE_BASE}/{self._db_prefix}/{collection_path}"
        results = []
        page_token = None

        while True:
            params: dict = {"pageSize": 300}
            if page_token:
                params["pageToken"] = page_token
            resp = self._session.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            results.extend(data.get("documents", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return results


# ---------------------------------------------------------------------------
# המרת ערכי Firestore ל-Python
# ---------------------------------------------------------------------------

def _fval(field: dict):
    """חילוץ ערך Python מייצוג שדה Firestore."""
    if "stringValue"  in field: return field["stringValue"]
    if "integerValue" in field: return int(field["integerValue"])
    if "doubleValue"  in field: return field["doubleValue"]
    if "booleanValue" in field: return field["booleanValue"]
    if "nullValue"    in field: return None
    if "arrayValue"   in field:
        return [_fval(v) for v in field["arrayValue"].get("values", [])]
    if "mapValue"     in field:
        return {k: _fval(v) for k, v in field["mapValue"].get("fields", {}).items()}
    return None


def doc_to_dict(doc: dict) -> dict:
    return {k: _fval(v) for k, v in doc.get("fields", {}).items()}


def doc_id(doc: dict) -> str:
    return doc["name"].split("/")[-1]


# ---------------------------------------------------------------------------
# Rules engine
# ---------------------------------------------------------------------------

def apply_rule(value: str | None, rule: dict) -> str | None:
    if value is None:
        return value
    t = rule.get("type")
    v = rule.get("value", "")
    if t == "append":  return str(value) + v
    if t == "prepend": return v + str(value)
    if t == "replace": return str(value).replace(rule.get("find", ""), v)
    raise ValueError(f"סוג rule לא מוכר: {t!r}")


def apply_rules(item_dict: dict, rules: list[dict]) -> dict[str, dict]:
    changes = {}
    for rule in rules:
        field = rule.get("field")
        if not field:
            continue
        before = item_dict.get(field)
        after = apply_rule(before, rule)
        if before != after:
            changes[field] = {"before": before, "after": after}
    return changes


# ---------------------------------------------------------------------------
# שליפת נתונים
# ---------------------------------------------------------------------------

def fetch_prayer_name(fs: FirestoreClient, translation_id: str, prayer_id: str) -> str | None:
    doc = fs.get_document(f"translations/{translation_id}/prayers/{prayer_id}")
    if not doc:
        return None
    prayer_dict = doc_to_dict(doc)
    return (
        prayer_dict.get("name")
        or prayer_dict.get("title")
        or prayer_dict.get("heName")
        or prayer_dict.get("type")
    )


def fetch_toc_navigation_map(
    fs: FirestoreClient, nusach_id: str, translation_id: str
) -> dict[str, dict[str, str | None]]:
    """
    שולף ממסמך toc/<nusachId> מיפוי של prayerId -> {categoryName, prayerName}.
    זהו מבנה הניווט שבו ה-CMS משתמש בפועל.
    """
    toc_doc = fs.get_document(f"toc/{nusach_id}")
    if not toc_doc:
        return {}

    toc_dict = doc_to_dict(toc_doc)
    translations = toc_dict.get("translations") or []
    translation = next(
        (t for t in translations if t.get("translationId") == translation_id),
        None,
    )
    if not translation:
        return {}

    nav_map: dict[str, dict[str, str | None]] = {}
    for category in translation.get("categories") or []:
        category_name = category.get("name")
        for prayer in category.get("prayers") or []:
            prayer_id = prayer.get("id")
            if not prayer_id:
                continue
            nav_map[str(prayer_id)] = {
                "categoryName": category_name,
                "prayerName": prayer.get("name"),
            }
    return nav_map


def collect_items(fs: FirestoreClient, scope: dict, limit: int | None = None) -> list[tuple]:
    translation_id = scope["translationId"]
    nusach_id = scope["nusachId"]
    prayer_id = scope.get("prayerId")
    toc_nav_map = fetch_toc_navigation_map(fs, nusach_id, translation_id)

    if prayer_id:
        prayer_ids = [prayer_id]
    else:
        print(f"  שולף רשימת תפילות עבור {translation_id}...")
        prayer_docs = fs.list_collection(f"translations/{translation_id}/prayers")
        prayer_ids = [doc_id(d) for d in prayer_docs]
        print(f"  נמצאו {len(prayer_ids)} תפילות")

    if limit:
        print(f"  [מצב בדיקה] שולף עד {limit} פריטים בלבד")

    all_items = []
    for pid in prayer_ids:
        if limit and len(all_items) >= limit:
            break
        nav_entry = toc_nav_map.get(str(pid), {})
        prayer_name = (
            nav_entry.get("prayerName")
            or fetch_prayer_name(fs, translation_id, pid)
        )
        category_name = nav_entry.get("categoryName")
        print(f"  שולף items לתפילה {pid} ({prayer_name or '?'})...", end=" ", flush=True)
        item_docs = fs.list_collection(f"translations/{translation_id}/prayers/{pid}/items")
        print(f"{len(item_docs)} פריטים")
        for doc in item_docs:
            all_items.append(
                (
                    translation_id,
                    pid,
                    category_name,
                    prayer_name,
                    doc_id(doc),
                    doc_to_dict(doc),
                )
            )
            if limit and len(all_items) >= limit:
                break

    return all_items


# ---------------------------------------------------------------------------
# לוגיקה ראשית
# ---------------------------------------------------------------------------

def generate_changes(config_path: Path, limit: int | None = None) -> None:
    with open(config_path, encoding="utf-8") as f:
        config = json.load(f)

    project_id = config["project_id"]
    scope = dict(config["scope"])
    scope["nusachId"] = scope.get("nusachId") or derive_nusach_id(scope["translationId"])
    rules = config["rules"]
    effective_limit = limit if limit is not None else config.get("limit")

    sa_path = find_service_account(project_id, config.get("credentials_path"))
    print(f"מתחבר ל-Firestore (project: {project_id}) עם: {sa_path.name}")
    fs = FirestoreClient(project_id, sa_path)

    print(f"שולף פריטים לפי scope: {scope}")
    raw_items = collect_items(fs, scope, limit=effective_limit)
    print(f"\nסה\"כ פריטים שנשלפו: {len(raw_items)}")

    changes_list = []
    for translation_id, prayer_id, category_name, prayer_name, item_id, item_dict in raw_items:
        field_changes = apply_rules(item_dict, rules)
        if not field_changes:
            continue
        changes_list.append({
            "path":          f"translations/{translation_id}/prayers/{prayer_id}/items/{item_id}",
            "nusachId":      scope["nusachId"],
            "translationId": translation_id,
            "categoryName":  category_name,
            "prayerId":      prayer_id,
            "prayerName":    prayer_name,
            "itemId":        item_id,
            "mit_id":        item_dict.get("mit_id"),
            "partId":        item_dict.get("partId"),
            "partName":      item_dict.get("partName"),
            "fields":        field_changes,
        })

    output = {
        "generated_at":  datetime.now(timezone.utc).isoformat(),
        "project_id":    project_id,
        "scope":         scope,
        "rules_applied": rules,
        "summary": {
            "total_items_scanned": len(raw_items),
            "total_changes":       len(changes_list),
        },
        "changes": changes_list,
    }

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = SCRIPT_DIR / f"changes_{timestamp_str}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nנמצאו {len(changes_list)} פריטים לשינוי מתוך {len(raw_items)} שנסרקו")
    print(f"קובץ פלט נשמר: {output_path}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="מייצר JSON של שינויים עתידיים בפריטי תפילה ב-Firestore"
    )
    parser.add_argument(
        "--config", type=Path, default=DEFAULT_CONFIG,
        help=f"נתיב לקובץ config (ברירת מחדל: {DEFAULT_CONFIG})",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="שלוף עד N פריטים בלבד (לבדיקות). למשל: --limit 10",
    )
    args = parser.parse_args()

    if not args.config.exists():
        sys.exit(
            f"שגיאה: קובץ config לא נמצא: {args.config}\n"
            "צור קובץ changes_config.json לפי התבנית בתיעוד."
        )

    generate_changes(args.config, limit=args.limit)


if __name__ == "__main__":
    main()
