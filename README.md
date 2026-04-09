# Chronolines

A multi-track historical timeline for 7 countries spanning 1700–2025, built as a pure static web application — no frameworks, no build step required to run.

**Live demo:** https://handsomevictor.github.io/chronolines

![Timeline screenshot](https://handsomevictor.github.io/chronolines/favicon.svg)

---

## Features

### Visualization
- **7 parallel country tracks** — China, UK, France, USA, Russia, Germany, Japan
- **3-tier event system** — Level 1 (major turning points), Level 2 (significant events), Level 3 (detailed records); 2,238 events total
- **Ruler bars** — 8px colored strips at the top of each track showing ruling periods (151 rulers across 7 countries), with names at higher zoom levels
- **Figure swim lanes** — overlay historical figures' lifespans as colored bars, filterable by domain (politics / military / science / literature / music / art / economics / philosophy)
- **Cross-track arc lines** — Bézier curves connecting related events across countries, triggered on click

### Interaction
- **Scroll-wheel zoom** with configurable min/max bounds; zoom-dependent event visibility (>50 yr/viewport → L1 only; 10–50 yr → L1+2; <10 yr → all)
- **Click-and-drag pan**; vertical scroll for tall track stacks
- **Drag-to-reorder** country tracks — grab the handle on any sidebar card, drag up/down; order persists in `localStorage`
- **Tag filter** — 10 event categories (战争 / 条约外交 / 革命政变 / 改革运动 / 经济贸易 / 科技发明 / 文化思想 / 王朝更迭 / 殖民扩张 / 人物)
- **Level selector** — force display up to L1, L2, or L3 regardless of zoom
- **Event clustering** — events within 8px on the same track merge into a count bubble (disabled when zoomed in past 20px/yr)
- **Hover crosshair** — vertical line + floating year pill that tracks the mouse across the full timeline
- **Tooltip** — 3-section layout (metadata / title / summary + tags + linked figures); edge-aware positioning
- **Detail drawer** — right-side panel with full event description, slides in on click

### Data
- **YAML source files** per country per century, compiled to `js/data.json` via a Python script
- **353 historical figures** with birth/death years, domain categories, and linked events
- Factual, neutral tone — no editorializing, disputed facts presented with multiple perspectives

---

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | SVG (layered `<g>` groups) + Canvas 2D (time axis) |
| Logic | Vanilla JavaScript (ES5-compatible, no bundler) |
| Layout | Custom greedy lane-stacking for label collision detection |
| Data | YAML → Python 3 → JSON |
| Deployment | GitHub Pages (static, root of `main` branch) |
| Styling | CSS custom properties, no preprocessor |

---

## Getting Started

### Prerequisites
- Python 3.8+
- `pip install pyyaml`

### Run locally

```bash
git clone https://github.com/handsomevictor/chronolines.git
cd chronolines

# Compile YAML data sources → js/data.json
python scripts/build.py

# Validate data integrity
python scripts/validate.py

# Serve locally (must use a server — fetch() doesn't work on file://)
python -m http.server 8000
# Open http://localhost:8000
```

---

## Project Structure

```
chronolines/
├── index.html              # Single-page entry point
├── style.css               # All styles (CSS custom properties, dark theme)
├── favicon.svg             # Inline SVG icon
│
├── scripts/
│   ├── build.py            # Compiles data/**/*.yaml → js/data.json
│   └── validate.py         # Checks IDs, required fields, tag whitelist
│
├── data/
│   ├── tracks.yaml         # Track definitions + 151 rulers per country
│   ├── events/
│   │   ├── china/          # 1700-1800.yaml, 1800-1900.yaml, 1900-1950.yaml, 1950-2000.yaml
│   │   ├── uk/
│   │   ├── france/
│   │   ├── usa/
│   │   ├── russia/
│   │   ├── germany/
│   │   └── japan/
│   └── figures/
│       ├── china.yaml      # Historical figures per country
│       ├── uk.yaml
│       └── ...
│
└── js/
    ├── data.json           # Compiled output — committed to repo (Pages has no build env)
    ├── main.js             # App state, initialization, keyboard shortcuts
    ├── canvas.js           # SVG rendering engine (tracks, events, rulers, figures, hover)
    ├── layout.js           # Zoom math, lane assignment, clustering logic
    ├── controls.js         # Filter UI, zoom buttons, search
    ├── tooltip.js          # Tooltip positioning and content
    └── drag-sort.js        # Pointer Events drag-to-reorder for sidebar tracks
```

---

## Data Format

### Event (`data/events/<country>/<period>.yaml`)

```yaml
- id: opium_war_1           # Globally unique, snake_case
  year: 1840                # Start year (required)
  endYear: 1842             # End year (optional, for spans)
  level: 1                  # 1 / 2 / 3 (required)
  title: 第一次鸦片战争
  summary: 英国对华宣战，清军战败，签订《南京条约》割让香港岛   # ≤50 chars
  detail: |                 # Optional long-form description
    ...
  tags: [战争, 条约外交]
  related: [treaty_nanking, uk_industrial_peak]   # Cross-reference event IDs
  figures: [linzexu, daoguang]                    # Cross-reference figure IDs
```

**Available tags:** `战争` / `条约外交` / `革命政变` / `改革运动` / `经济贸易` / `科技发明` / `文化思想` / `王朝更迭` / `殖民扩张` / `人物`

### Figure (`data/figures/<country>.yaml`)

```yaml
- id: linzexu
  name: 林则徐
  birthYear: 1785
  deathYear: 1850
  category: 政治             # 政治/军事/科学/文学/音乐/艺术/经济金融/哲学思想
  level: 2                  # Controls display prominence
  summary: 主导虎门销烟，是清末最早主张了解西方的官员之一
  events: [opium_war_1, canton_system]
```

### Track (`data/tracks.yaml`)

```yaml
- id: china
  name: 中国
  color: "#e05c4f"
  rulers:
    - name: 康熙帝
      title: 清朝皇帝
      start: 1661
      end: 1722
    - ...
```

---

## Adding Data

1. Edit YAML files in `data/events/` or `data/figures/`
2. Run `python scripts/build.py` — output goes to `js/data.json`
3. Run `python scripts/validate.py` — check for errors
4. Commit **both** the YAML changes and the updated `js/data.json`

```bash
git add -A
git commit -m "data: add French Revolution events"
git push origin main
```

GitHub Pages updates within ~1–2 minutes of push.

> **Why commit `js/data.json`?** GitHub Pages serves static files directly — there is no server-side build step. The compiled JSON must be in the repo.

---

## Architecture Notes

### Rendering pipeline

The SVG canvas uses 8 ordered `<g>` layers to control z-order:

```
layer-bands   → track background tints
layer-rulers  → ruler period bars (8px strips)
layer-grid    → vertical year gridlines
layer-figures → figure lifespan bars (swim lanes)
layer-events  → event dots and cluster bubbles
layer-arcs    → cross-track Bézier arc lines
layer-labels  → event text labels (collision-detected)
layer-hover   → crosshair band + vertical line
```

### Coordinate system

```
x = (year - YEAR_START) * ppy + panX
    where ppy = pixels per year (zoom level)
          panX = horizontal pan offset in pixels

y = PAD_TOP + trackIndex * TRACK_HEIGHT + offset
    where TRACK_HEIGHT = 160px
          PAD_TOP = 96px
```

### Zoom-dependent rendering

| Viewport span | Events shown | Clustering |
|---|---|---|
| > 50 years | Level 1 only | Always |
| 10–50 years | Level 1 + 2 | Always |
| < 10 years | All levels | Disabled |

Level 2 and 3 events fade in/out smoothly across thresholds using opacity transitions.

---

## Customization

### Add a new country
1. Add a track entry to `data/tracks.yaml`
2. Create `data/events/<country>/` with YAML files
3. Create `data/figures/<country>.yaml`
4. Add the country ID to `DEFAULT_TRACK_ORDER` in `js/main.js`
5. Add a color to `TRACK_COLORS` in `js/canvas.js`
6. Rebuild: `python scripts/build.py`

### Change the time range
Edit `YEAR_START` and `YEAR_END` in `js/main.js`. The time axis and all coordinate math derive from these constants.

### Adjust track height
Change `TRACK_HEIGHT` in `js/canvas.js`. All layout offsets (ruler bars, figure lanes, event lines, label positions) are computed relative to this constant.

---

## Editorial Policy

All event descriptions follow a strict factual standard:
- **No editorializing** — state what happened, not whether it was good or bad
- **Disputed figures** — note the dispute; do not pick a side
- **Multi-country events** — no single national perspective dominates the summary
- **Summary field** — hard limit of 50 characters; core fact only

---

## License

MIT
