/**
 * layout.js — Coordinate math, zoom levels, label collision detection,
 *             event clustering.
 */

var Layout = (function () {
  'use strict';

  // ─── Zoom / Level ──────────────────────────────────────────────────────────

  /**
   * Returns which event levels are visible given current pixels-per-year.
   * yearsPerGrid = years spanned by 100 pixels.
   */
  function visibleLevels(pixelsPerYear) {
    var yearsPerGrid = 100 / pixelsPerYear;
    if (yearsPerGrid > 50) return [1];
    if (yearsPerGrid > 10) return [1, 2];
    return [1, 2, 3];
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

  // ─── Clustering ────────────────────────────────────────────────────────────

  /**
   * Cluster events within a track that are closer than MIN_PX pixels.
   * Level 1 events are never clustered.
   * Returns array of groups; each group is an array of events.
   */
  var MIN_CLUSTER_PX = 8;

  function clusterEvents(events, pixelsPerYear, panX) {
    if (!events || !events.length) return [];

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
        if (nextX - groupX < MIN_CLUSTER_PX) {
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

  /**
   * Assign Y positions to event labels using a greedy lane-stacking algorithm.
   *
   * Each label occupies a bounding box:
   *   x = event x − LABEL_W/2  (we approximate label width)
   *   width = LABEL_W
   *   height = LABEL_H
   *
   * We stack labels upward in lanes. Lane 0 is just above the track line.
   * If a new label overlaps something in lane k, try lane k+1 (higher up).
   *
   * Returns array of {event, x, labelY, laneY} objects.
   */
  var LABEL_H       = 14;   // estimated label height (px)
  var LABEL_GAP     = 3;    // vertical gap between stacked labels
  var LABEL_STEP    = LABEL_H + LABEL_GAP;
  var LABEL_X_PAD   = 4;    // horizontal clearance between labels (px)

  function layoutLabels(events, trackY, pixelsPerYear, panX, svgWidth) {
    if (!events || !events.length) return [];

    // Build items sorted by x
    var items = events.map(function (e) {
      var x = yearToX(e.year, panX, pixelsPerYear);
      var wEst = estimateLabelWidth(e.title, e.level);
      return { event: e, x: x, w: wEst };
    });

    items.sort(function (a, b) { return a.x - b.x; });

    // placed = array of {x, w, labelY}
    var placed = [];

    var results = items.map(function (item) {
      if (item.x < -50 || item.x > svgWidth + 50) {
        return { event: item.event, x: item.x, labelY: null };
      }

      // Try lanes: 0 = closest to track, higher = further up
      var baseY = trackY - 18;  // default: just above the track dot
      var labelY = baseY;
      var found = false;

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

      if (!found) { labelY = null; } // give up — too crowded

      placed.push({ x: item.x, w: item.w, labelY: labelY });
      return { event: item.event, x: item.x, labelY: labelY };
    });

    return results;
  }

  /** Rough label width estimation (characters × font-size × factor) */
  function estimateLabelWidth(title, level) {
    if (!title) return 60;
    var fontSize = level === 1 ? 12 : 11;
    var charWidth = fontSize * 0.56;  // approximate for mixed CJK+Latin
    return Math.min(title.length * charWidth, 160);
  }

  // ─── Grid intervals ─────────────────────────────────────────────────────────

  /**
   * Choose grid tick intervals based on zoom level.
   * Returns { major, minor } in years.
   */
  function gridIntervals(pixelsPerYear) {
    var ppy = pixelsPerYear;
    if (ppy < 0.3)       return { major: 100, minor: 50 };
    if (ppy < 0.8)       return { major: 50,  minor: 10 };
    if (ppy < 2)         return { major: 25,  minor: 5  };
    if (ppy < 6)         return { major: 10,  minor: 2  };
    if (ppy < 15)        return { major: 5,   minor: 1  };
    return               { major: 2,   minor: 1  };
  }

  return {
    visibleLevels:  visibleLevels,
    yearToX:        yearToX,
    xToYear:        xToYear,
    visibleRange:   visibleRange,
    filterByTag:    filterByTag,
    filterBySearch: filterBySearch,
    clusterEvents:  clusterEvents,
    layoutLabels:   layoutLabels,
    gridIntervals:  gridIntervals,
    estimateLabelWidth: estimateLabelWidth,
  };
})();
