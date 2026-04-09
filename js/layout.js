/**
 * layout.js — Coordinate math, zoom levels, label collision detection,
 *             event clustering, figure lane assignment.
 *
 * Fix 3: shouldCluster() — auto expand/collapse based on pixelsPerYear
 * Fix 4: getZoomMaxLevel(), getEventOpacity() — smooth level transitions
 * Fix 5: assignFigureLanes() — swim-lane layout for figure bars
 */

var Layout = (function () {
  'use strict';

  // ─── Fix 4: Zoom → Max Level ───────────────────────────────────────────────

  /**
   * Return the maximum event level that should be VISIBLE at this zoom.
   * yearsPerViewport100px = number of years that fit in 100 SVG pixels.
   */
  function getZoomMaxLevel(pixelsPerYear) {
    var yearsPerVP = 100 / pixelsPerYear;
    if (yearsPerVP > 50) return 1;   // very zoomed out → Level 1 only
    if (yearsPerVP > 15) return 2;   // medium → L1 + L2
    return 3;                         // zoomed in → all three
  }

  /**
   * Legacy wrapper: returns an array of visible level numbers.
   * Used by canvas.js drawEvents filter.
   */
  function visibleLevels(pixelsPerYear) {
    var max = getZoomMaxLevel(pixelsPerYear);
    var arr = [1];
    if (max >= 2) arr.push(2);
    if (max >= 3) arr.push(3);
    return arr;
  }

  /**
   * Fix 4: Compute per-event opacity for smooth zoom-level transitions.
   *
   * Level 2 fades in/out in the yearsPerVP range 40–60.
   * Level 3 fades in/out in the yearsPerVP range 10–20.
   * Level 1 is always fully visible (1.0).
   */
  function getEventOpacity(eventLevel, pixelsPerYear) {
    var yearsPerVP = 100 / pixelsPerYear;

    if (eventLevel === 1) return 1;

    if (eventLevel === 2) {
      if (yearsPerVP < 40) return 1;
      if (yearsPerVP > 60) return 0;
      return 1 - (yearsPerVP - 40) / 20;
    }

    if (eventLevel === 3) {
      if (yearsPerVP < 10) return 1;
      if (yearsPerVP > 20) return 0;
      return 1 - (yearsPerVP - 10) / 10;
    }

    return 1;
  }

  // ─── Coordinate transforms ─────────────────────────────────────────────────

  /** Year → SVG x-coordinate */
  function yearToX(year, panX, pixelsPerYear) {
    return (year - App.YEAR_START) * pixelsPerYear + panX;
  }

  /** SVG x-coordinate → Year */
  function xToYear(x, panX, pixelsPerYear) {
    return App.YEAR_START + (x - panX) / pixelsPerYear;
  }

  /** Return visible year range (with a small buffer) */
  function visibleRange(panX, svgWidth, pixelsPerYear) {
    var s = xToYear(0, panX, pixelsPerYear);
    var e = xToYear(svgWidth, panX, pixelsPerYear);
    return {
      start: Math.max(App.YEAR_START, Math.floor(s) - 5),
      end:   Math.min(App.YEAR_END,   Math.ceil(e)  + 5),
    };
  }

  // ─── Filtering ──────────────────────────────────────────────────────────────

  function filterByTag(events, activeTag) {
    if (!activeTag || activeTag === 'all') return events;
    return events.filter(function (e) {
      return e.tags && e.tags.indexOf(activeTag) !== -1;
    });
  }

  function filterBySearch(events, query) {
    if (!query) return events;
    var q = query.toLowerCase();
    return events.filter(function (e) {
      return (e.title && e.title.toLowerCase().indexOf(q) !== -1) ||
             (e.summary && e.summary.toLowerCase().indexOf(q) !== -1);
    });
  }

  // ─── Fix 3: Clustering ─────────────────────────────────────────────────────

  /**
   * When pixelsPerYear > 20, never cluster — show all events individually.
   * When pixelsPerYear <= 20, cluster events closer than CLUSTER_THRESHOLD_PX.
   */
  var CLUSTER_THRESHOLD_PX = 12;

  function shouldCluster(pixelsPerYear) {
    return pixelsPerYear < 20;
  }

  /**
   * Cluster events within a track that are closer than CLUSTER_THRESHOLD_PX.
   * Level 1 events are never clustered.
   * Returns array of groups; each group is an array of events.
   */
  function clusterEvents(events, pixelsPerYear, panX) {
    if (!events || !events.length) return [];

    // High zoom: never cluster — each event is its own singleton group
    if (!shouldCluster(pixelsPerYear)) {
      return events.map(function (e) { return [e]; });
    }

    // Sort by year
    var sorted = events.slice().sort(function (a, b) { return a.year - b.year; });

    var groups = [];
    var i = 0;

    while (i < sorted.length) {
      var ev = sorted[i];

      // Level 1 is always a singleton group
      if (ev.level === 1) {
        groups.push([ev]);
        i++;
        continue;
      }

      // Start a new non-level-1 group
      var group = [ev];
      var groupX = yearToX(ev.year, panX, pixelsPerYear);

      while (i + 1 < sorted.length) {
        var next = sorted[i + 1];
        if (next.level === 1) break;
        var nextX = yearToX(next.year, panX, pixelsPerYear);
        if (nextX - groupX < CLUSTER_THRESHOLD_PX) {
          group.push(next);
          i++;
        } else {
          break;
        }
      }

      groups.push(group);
      i++;
    }

    return groups;
  }

  // ─── Label placement ────────────────────────────────────────────────────────

  var LABEL_H     = 14;
  var LABEL_GAP   = 3;
  var LABEL_STEP  = LABEL_H + LABEL_GAP;
  var LABEL_X_PAD = 4;

  function layoutLabels(events, trackY, pixelsPerYear, panX, svgWidth) {
    if (!events || !events.length) return [];

    var items = events.map(function (e) {
      var x    = yearToX(e.year, panX, pixelsPerYear);
      var wEst = estimateLabelWidth(e.title, e.level);
      return { event: e, x: x, w: wEst };
    });

    items.sort(function (a, b) { return a.x - b.x; });

    var placed = [];

    var results = items.map(function (item) {
      if (item.x < -50 || item.x > svgWidth + 50) {
        return { event: item.event, x: item.x, labelY: null };
      }

      var baseY  = trackY - 18;
      var labelY = baseY;
      var found  = false;

      for (var lane = 0; lane < 12; lane++) {
        labelY = baseY - lane * LABEL_STEP;
        var overlap = placed.some(function (p) {
          if (p.labelY === null) return false;
          var xOverlap = Math.abs(p.x - item.x) < ((p.w + item.w) / 2 + LABEL_X_PAD);
          var yOverlap = Math.abs(p.labelY - labelY) < LABEL_STEP;
          return xOverlap && yOverlap;
        });
        if (!overlap) { found = true; break; }
      }

      if (!found) { labelY = null; }

      placed.push({ x: item.x, w: item.w, labelY: labelY });
      return { event: item.event, x: item.x, labelY: labelY };
    });

    return results;
  }

  function estimateLabelWidth(title, level) {
    if (!title) return 60;
    var fontSize  = level === 1 ? 12 : 11;
    var charWidth = fontSize * 0.56;
    return Math.min(title.length * charWidth, 160);
  }

  // ─── Fix 5: Figure swim-lane assignment ─────────────────────────────────────

  /**
   * Assign each figure to a swim lane so overlapping lifespans don't collide.
   * Uses a greedy algorithm: find the first lane whose last occupant ended
   * before this figure's birthYear.
   *
   * @param  {Array} figures  Array of figure objects with birthYear, deathYear
   * @returns {Array}         Same figures with an added `.lane` property (0-based)
   */
  function assignFigureLanes(figures) {
    if (!figures || !figures.length) return [];

    // Sort by birth year so we assign lanes left to right
    var sorted = figures.slice().sort(function (a, b) {
      return (a.birthYear || 0) - (b.birthYear || 0);
    });

    // lanes[i] = the end year of the last figure placed in lane i
    var laneEndYears = [];

    var result = sorted.map(function (fig) {
      var birth = fig.birthYear || 0;
      var death = fig.deathYear || (fig.birthYear ? fig.birthYear + 10 : 0);

      // Find first free lane
      var lane = -1;
      for (var li = 0; li < laneEndYears.length; li++) {
        if (birth > laneEndYears[li] + 2) {
          lane = li;
          break;
        }
      }
      if (lane === -1) {
        lane = laneEndYears.length;
        laneEndYears.push(0);
      }
      laneEndYears[lane] = death;

      return Object.assign({}, fig, { lane: lane });
    });

    return result;
  }

  // ─── Grid intervals ─────────────────────────────────────────────────────────

  function gridIntervals(pixelsPerYear) {
    var ppy = pixelsPerYear;
    if (ppy < 0.3)  return { major: 100, minor: 50 };
    if (ppy < 0.8)  return { major: 50,  minor: 10 };
    if (ppy < 2)    return { major: 25,  minor: 5  };
    if (ppy < 6)    return { major: 10,  minor: 2  };
    if (ppy < 15)   return { major: 5,   minor: 1  };
    return               { major: 2,   minor: 1  };
  }

  return {
    getZoomMaxLevel:    getZoomMaxLevel,
    visibleLevels:      visibleLevels,
    getEventOpacity:    getEventOpacity,
    shouldCluster:      shouldCluster,
    yearToX:            yearToX,
    xToYear:            xToYear,
    visibleRange:       visibleRange,
    filterByTag:        filterByTag,
    filterBySearch:     filterBySearch,
    clusterEvents:      clusterEvents,
    layoutLabels:       layoutLabels,
    gridIntervals:      gridIntervals,
    estimateLabelWidth: estimateLabelWidth,
    assignFigureLanes:  assignFigureLanes,
  };
})();
