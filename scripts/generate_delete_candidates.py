"""
generate_delete_candidates.py – ייצור JSON של פריטים למחיקה (לבדיקת פעולת המחיקה ב-CMS).

קורא פריטים מ-Firestore לפי scope ב-config, בוחר מועמדים לפי כללי delete_candidates (when + limit),
ומייצר קובץ JSON לסקריפט apply_delete_changes.py.

קונפיג: delete_config.json
  - scope: כמו ב-changes_config (nusachId, translationId, prayerId...)
  - delete_candidates: רשימת כללים { "when": { "type": "instructions" }, "limit": 2 }

הרצה:
  python scripts/generate_delete_candidates.py
  python scripts/generate_delete_candidates.py --config scripts/delete_config.json --limit 20
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generate_changes import (
    SCRIPT_DIR,
    derive_nusach_id,
    find_service_account,
    FirestoreClient,
    collect_items,
)


def _rule_matches(item_context: dict, when: dict | None) -> bool:
    if not when:
        return True
    for key, expected in when.items():
        if item_context.get(key) != expected:
            return False
    return True


DEFAULT_CONFIG = Path(__file__).resolve().parent / "delete_config.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="מייצר JSON של מועמדים למחיקה (לבדיקת מחיקה ב-CMS)"
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=DEFAULT_CONFIG,
        help=f"נתיב לקובץ config (ברירת מחדל: {DEFAULT_CONFIG})",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="שלוף עד N פריטים מ-Firestore (לבדיקות). לא מגביל את מספר המועמדים למחיקה.",
    )
    args = parser.parse_args()

    if not args.config.exists():
        sys.exit(f"שגיאה: קובץ config לא נמצא: {args.config}")

    with open(args.config, encoding="utf-8") as f:
        config = json.load(f)

    project_id = config["project_id"]
    scope = dict(config["scope"])
    scope["nusachId"] = scope.get("nusachId") or derive_nusach_id(scope["translationId"])
    rules = config.get("delete_candidates", [])
    if not rules:
        sys.exit("שגיאה: אין delete_candidates בקונפיג.")

    sa_path = find_service_account(project_id, config.get("credentials_path"))
    print(f"מתחבר ל-Firestore (project: {project_id}) עם: {sa_path.name}")
    fs = FirestoreClient(project_id, sa_path)

    print(f"שולף פריטים לפי scope: {scope}")
    raw_items = collect_items(fs, scope, limit=args.limit)
    print(f"סה\"כ פריטים שנשלפו: {len(raw_items)}")

    delete_list = []
    rule_counts = [0] * len(rules)
    for translation_id, prayer_id, category_name, prayer_name, item_id, item_dict in raw_items:
        item_context = {
            "translationId": translation_id,
            "prayerId": prayer_id,
            "categoryName": category_name,
            "prayerName": prayer_name,
            "itemId": item_id,
            "partId": item_dict.get("partId"),
            "partName": item_dict.get("partName"),
            "type": item_dict.get("type"),
        }
        for i, rule in enumerate(rules):
            limit_val = rule.get("limit")
            if limit_val is not None and rule_counts[i] >= limit_val:
                continue
            if not _rule_matches(item_context, rule.get("when")):
                continue
            delete_list.append({
                "path": f"translations/{translation_id}/prayers/{prayer_id}/items/{item_id}",
                "nusachId": scope["nusachId"],
                "translationId": translation_id,
                "categoryName": category_name,
                "prayerName": prayer_name,
                "prayerId": prayer_id,
                "itemId": item_id,
                "partId": item_dict.get("partId"),
                "partName": item_dict.get("partName"),
            })
            if limit_val is not None:
                rule_counts[i] += 1
            break

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "project_id": project_id,
        "scope": scope,
        "delete_candidates_rules": rules,
        "summary": {
            "total_items_scanned": len(raw_items),
            "total_to_delete": len(delete_list),
        },
        "deletes": delete_list,
    }

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = SCRIPT_DIR / f"delete_candidates_{timestamp_str}.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nנמצאו {len(delete_list)} פריטים למחיקה מתוך {len(raw_items)} שנסרקו")
    print(f"קובץ פלט: {output_path}")


if __name__ == "__main__":
    main()
