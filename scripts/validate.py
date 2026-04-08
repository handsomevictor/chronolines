#!/usr/bin/env python3
"""
validate.py — Validates data.json structure and cross-references.
Usage: python scripts/validate.py
"""

import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(BASE_DIR, "js", "data.json")

VALID_TAGS = {
    "战争", "条约外交", "革命政变", "改革运动", "经济贸易",
    "科技发明", "文化思想", "王朝更迭", "殖民扩张", "人物"
}

VALID_LEVELS = {1, 2, 3}

errors = []
warnings = []


def err(msg):
    errors.append(msg)
    print(f"  ERROR: {msg}")


def warn(msg):
    warnings.append(msg)
    print(f"  WARN:  {msg}")


def validate():
    if not os.path.isfile(DATA_FILE):
        err(f"data.json not found at {DATA_FILE}. Run build.py first.")
        return False

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Validate tracks
    tracks = data.get("tracks", [])
    if not tracks:
        err("No tracks defined")
    track_ids = set()
    for i, track in enumerate(tracks):
        tid = track.get("id")
        if not tid:
            err(f"Track[{i}] missing 'id'")
        else:
            track_ids.add(tid)
        for field in ("name", "color", "order"):
            if field not in track:
                err(f"Track '{tid}' missing '{field}'")

    # Collect all event ids and figure ids for cross-reference
    all_event_ids = set()
    all_figure_ids = set()

    # Validate events
    events_dict = data.get("events", {})
    for track_id, events in events_dict.items():
        if track_id not in track_ids:
            err(f"Events found for unknown track '{track_id}'")
        for event in events:
            eid = event.get("id")
            if not eid:
                err(f"Event in track '{track_id}' missing 'id'")
                continue
            if eid in all_event_ids:
                err(f"Duplicate event id '{eid}'")
            all_event_ids.add(eid)

            # Required fields
            for field in ("year", "level", "title", "summary"):
                if field not in event:
                    err(f"Event '{eid}' missing required field '{field}'")

            # Level validation
            level = event.get("level")
            if level not in VALID_LEVELS:
                err(f"Event '{eid}' has invalid level '{level}' (must be 1, 2, or 3)")

            # Year validation
            year = event.get("year")
            if year is not None:
                if not isinstance(year, int):
                    err(f"Event '{eid}' year must be integer, got {type(year)}")
                elif year < 1700 or year > 2000:
                    warn(f"Event '{eid}' year {year} is outside expected range 1700-2000")

            end_year = event.get("endYear")
            if end_year is not None and year is not None:
                if end_year <= year:
                    err(f"Event '{eid}' endYear {end_year} must be > year {year}")

            # Summary length
            summary = event.get("summary", "")
            if len(summary) > 100:
                warn(f"Event '{eid}' summary length {len(summary)} chars (recommended <=50)")

            # Tags
            for tag in event.get("tags", []):
                if tag not in VALID_TAGS:
                    err(f"Event '{eid}' has invalid tag '{tag}'")

    # Validate figures
    figures_dict = data.get("figures", {})
    for track_id, figures in figures_dict.items():
        if track_id not in track_ids:
            err(f"Figures found for unknown track '{track_id}'")
        for figure in figures:
            fid = figure.get("id")
            if not fid:
                err(f"Figure in track '{track_id}' missing 'id'")
                continue
            if fid in all_figure_ids:
                err(f"Duplicate figure id '{fid}'")
            all_figure_ids.add(fid)

            for field in ("name", "summary"):
                if field not in figure:
                    err(f"Figure '{fid}' missing '{field}'")

    # Cross-reference: events.related and events.figures
    for track_id, events in events_dict.items():
        for event in events:
            eid = event.get("id", "?")
            for ref_id in event.get("related", []):
                if ref_id not in all_event_ids:
                    warn(f"Event '{eid}' references unknown related event '{ref_id}'")
            for fig_id in event.get("figures", []):
                if fig_id not in all_figure_ids:
                    warn(f"Event '{eid}' references unknown figure '{fig_id}'")

    # Summary
    print(f"\nValidation complete:")
    print(f"  Events:   {len(all_event_ids)}")
    print(f"  Figures:  {len(all_figure_ids)}")
    print(f"  Errors:   {len(errors)}")
    print(f"  Warnings: {len(warnings)}")

    return len(errors) == 0


if __name__ == "__main__":
    print("Validating js/data.json...")
    success = validate()
    sys.exit(0 if success else 1)
