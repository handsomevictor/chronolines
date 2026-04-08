/**
 * layout.js — Layout calculations: zoom level, event visibility,
 *             label collision avoidance, event clustering.
 */

var Layout = (function () {
  'use strict';

  // Returns which levels to show based on years-per-pixel
  function visibleLevels(pixelsPerYear) {
    var yearsPerPixel = 1 / pixelsPerYear;
    // We need "years per screen unit" — approximate by reciprocal
    // The zoom represents pixels per year, so yearsPerGrid = 50px / pixelsPerYear
    var yearsPerGrid = 50 / pixelsPerYear;

    if (yearsPerGrid > 50) {
      return [1];
    } else if (yearsPerGrid > 10) {
      return [1, 2];
    } else {
      return [1, 2, 3];
    }
  }

  // Convert a year to an x-coordinate on the SVG canvas
  function yearToX(year, panX, pixelsPerYear) {
    return (year - App.YEAR_START) * pixelsPerYear + panX;
  }

  // Convert x-coordinate back to year
  function xToYear(x, panX, pixelsPerYear) {
    return App.YEAR_START + (x - panX) / pixelsPerYear;
  }

  // Given an array of events in one track that are visible, cluster those
  // within CLUSTER_THRESHOLD px of each other (level 1 never clustered).
  var CLUSTER_THRESHOLD = 5; // px between dots to trigger merge

  function clusterEvents(events, pixelsPerYear, panX) {
    if (!events.length) return [];

    var sorted = events.slice().sort(function (a, b) { return a.year - b.year; });
    var groups = [];
    var current = [sorted[0]];

    for (var i = 1; i < sorted.length; i++) {
      var prev = sorted[i - 1];
      var curr = sorted[i];
      var prevX = yearToX(prev.year, panX, pixelsPerYear);
      var currX = yearToX(curr.year, panX, pixelsPerYear);

      // Level 1 events are never clustered
      if (curr.level === 1 || prev.level === 1) {
        groups.push(current);
        current = [curr];
        continue;
      }

      if (currX - prevX < CLUSTER_THRESHOLD) {
        current.push(curr);
      } else {
        groups.push(current);
        current = [curr];
      }
    }
    groups.push(current);
    return groups;
  }

  // Simple label collision nudge: returns array of {event, labelY} pairs
  function layoutLabels(events, trackY, pixelsPerYear, panX) {
    var positions = events.map(function (e) {
      return {
        event: e,
        x: yearToX(e.year, panX, pixelsPerYear),
        y: trackY,
      };
    });

    // Sort by x
    positions.sort(function (a, b) { return a.x - b.x; });

    // Simple greedy nudge upward/downward to avoid overlap
    var MIN_SPACING = 14;
    var placed = [];
    positions.forEach(function (pos) {
      var labelY = pos.y - 18; // default above track
      // Check collision with already placed labels
      for (var attempts = 0; attempts < 6; attempts++) {
        var collision = placed.some(function (p) {
          return Math.abs(p.x - pos.x) < 60 && Math.abs(p.labelY - labelY) < MIN_SPACING;
        });
        if (!collision) break;
        labelY -= MIN_SPACING;
      }
      pos.labelY = labelY;
      placed.push(pos);
    });

    return positions;
  }

  // Filter events by active tag
  function filterByTag(events, activeTag) {
    if (activeTag === 'all') return events;
    return events.filter(function (e) {
      return e.tags && e.tags.indexOf(activeTag) !== -1;
    });
  }

  // Get visible year range given current panX and SVG width
  function visibleYearRange(panX, svgWidth, pixelsPerYear) {
    var startYear = xToYear(0, panX, pixelsPerYear);
    var endYear = xToYear(svgWidth, panX, pixelsPerYear);
    return {
      start: Math.max(App.YEAR_START, Math.floor(startYear) - 10),
      end: Math.min(App.YEAR_END, Math.ceil(endYear) + 10),
    };
  }

  return {
    visibleLevels: visibleLevels,
    yearToX: yearToX,
    xToYear: xToYear,
    clusterEvents: clusterEvents,
    layoutLabels: layoutLabels,
    filterByTag: filterByTag,
    visibleYearRange: visibleYearRange,
  };
})();
