#!/usr/bin/env python3
"""
Post-build validation hook.
Runs after build.py to validate the generated data.json.
Called automatically by orchestrator after data-agent runs build.py.
"""
import json
import sys
from pathlib import Path

REQUIRED_EVENT_FIELDS = {"id", "year", "level", "title", "summary", "tags", "track"}
VALID_LEVELS = {1, 2, 3}
VALID_TAGS = {
    "战争", "条约外交", "革命政变", "改革运动",
    "经济贸易", "科技发明", "文化思想", "王朝更迭", "殖民扩张", "人物"
}

def validate(data_path="js/data.json"):
    errors = []
    warnings = []

    try:
        data = json.loads(Path(data_path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        print(f"❌ {data_path} not found. Run build.py first.")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"❌ JSON parse error: {e}")
        sys.exit(1)

    events = data.get("events", [])
    figures = data.get("figures", [])
    event_ids = {e["id"] for e in events if "id" in e}
    figure_ids = {f["id"] for f in figures if "id" in f}

    for i, event in enumerate(events):
        ref = f"Event[{i}] '{event.get('id', '?')}'"

        # Required fields
        missing = REQUIRED_EVENT_FIELDS - set(event.keys())
        if missing:
            errors.append(f"{ref}: missing fields {missing}")

        # Level check
        if event.get("level") not in VALID_LEVELS:
            errors.append(f"{ref}: invalid level '{event.get('level')}'")

        # Year check
        if not isinstance(event.get("year"), int):
            errors.append(f"{ref}: year must be integer")

        # Tags check
        for tag in event.get("tags", []):
            if tag not in VALID_TAGS:
                errors.append(f"{ref}: unknown tag '{tag}'")

        # Related refs check
        for rel_id in event.get("related", []):
            if rel_id not in event_ids:
                warnings.append(f"{ref}: related id '{rel_id}' not found in events")

        # Figures refs check
        for fig_id in event.get("figures", []):
            if fig_id not in figure_ids:
                warnings.append(f"{ref}: figure id '{fig_id}' not found in figures")

        # Summary length check
        summary = event.get("summary", "")
        if len(summary) > 80:
            warnings.append(f"{ref}: summary too long ({len(summary)} chars, recommend ≤50)")

    print(f"\n📊 Validation report: {len(events)} events, {len(figures)} figures")

    if warnings:
        print(f"\n⚠️  {len(warnings)} warnings:")
        for w in warnings:
            print(f"   {w}")

    if errors:
        print(f"\n❌ {len(errors)} errors:")
        for e in errors:
            print(f"   {e}")
        print("\nBuild failed. Fix errors before proceeding.")
        sys.exit(1)
    else:
        print(f"\n✅ Validation passed ({len(warnings)} warnings)")

if __name__ == "__main__":
    validate()
