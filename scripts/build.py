#!/usr/bin/env python3
"""
build.py — Compiles YAML data sources into js/data.json for GitHub Pages.
Usage: python scripts/build.py
"""

import json
import os
import sys
import yaml

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT_FILE = os.path.join(BASE_DIR, "js", "data.json")

VALID_TAGS = {
    "战争", "条约外交", "革命政变", "改革运动", "经济贸易",
    "科技发明", "文化思想", "王朝更迭", "殖民扩张", "人物"
}


def load_yaml(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or []


def build():
    result = {
        "tracks": [],
        "events": {},
        "figures": {}
    }

    # Load tracks
    tracks_file = os.path.join(DATA_DIR, "tracks.yaml")
    tracks_data = load_yaml(tracks_file)
    result["tracks"] = tracks_data.get("tracks", [])

    track_ids = [t["id"] for t in result["tracks"]]

    # Load events per track
    events_dir = os.path.join(DATA_DIR, "events")
    all_events = []
    for track_id in track_ids:
        track_dir = os.path.join(events_dir, track_id)
        if not os.path.isdir(track_dir):
            print(f"  Warning: no events directory for track '{track_id}'", file=sys.stderr)
            result["events"][track_id] = []
            continue

        track_events = []
        yaml_files = sorted([f for f in os.listdir(track_dir) if f.endswith(".yaml")])
        for fname in yaml_files:
            filepath = os.path.join(track_dir, fname)
            events = load_yaml(filepath)
            if not isinstance(events, list):
                print(f"  Warning: {filepath} did not parse as a list", file=sys.stderr)
                continue
            for event in events:
                event["track"] = track_id
                track_events.append(event)
                all_events.append(event)

        result["events"][track_id] = track_events
        print(f"  Loaded {len(track_events)} events for track '{track_id}'")

    # Validate and warn on unknown tags
    for event in all_events:
        tags = event.get("tags", [])
        for tag in tags:
            if tag not in VALID_TAGS:
                print(f"  Warning: unknown tag '{tag}' in event '{event.get('id')}'", file=sys.stderr)

    # Load figures per track
    figures_dir = os.path.join(DATA_DIR, "figures")
    for track_id in track_ids:
        figures_file = os.path.join(figures_dir, f"{track_id}.yaml")
        if not os.path.isfile(figures_file):
            result["figures"][track_id] = []
            continue
        figures = load_yaml(figures_file)
        if not isinstance(figures, list):
            result["figures"][track_id] = []
            continue
        result["figures"][track_id] = figures
        print(f"  Loaded {len(figures)} figures for track '{track_id}'")

    # Build flat index of all events and figures for cross-reference
    result["_meta"] = {
        "built_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "total_events": len(all_events),
        "total_figures": sum(len(v) for v in result["figures"].values())
    }

    # Write output
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"\nBuild complete: {OUTPUT_FILE}")
    print(f"  Total events: {result['_meta']['total_events']}")
    print(f"  Total figures: {result['_meta']['total_figures']}")
    return True


if __name__ == "__main__":
    print("Building js/data.json from YAML sources...")
    try:
        success = build()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Build failed: {e}", file=sys.stderr)
        sys.exit(1)
