/**
 * canvas.js — SVG rendering engine.
 * Draws the timeline grid, track lines, event dots and labels.
 */

var Canvas = (function () {
  'use strict';

  var svg, svgContent, gridLayer, arcsLayer, tracksLayer, eventsLayer, labelsLayer;
  var trackLabelsEl;
  var svgWidth, svgHeight;

  // Layout constants
  var AXIS_HEIGHT = 40;      // px for year axis at top
  var TRACK_HEIGHT = 80;     // px per track
  var TRACK_GAP = 16;        // px between tracks

  // Dot sizes per level
  var DOT_RADIUS = { 1: 7, 2: 5, 3: 3.5 };

  function init() {
    svg = document.getElementById('timeline-svg');
    svgContent = document.getElementById('svg-content');
    gridLayer = document.getElementById('grid-layer');
    arcsLayer = document.getElementById('arcs-layer');
    tracksLayer = document.getElementById('tracks-layer');
    eventsLayer = document.getElementById('events-layer');
    labelsLayer = document.getElementById('labels-layer');
    trackLabelsEl = document.getElementById('track-labels');

    // Set initial zoom: fit the full year range
    var wrapper = document.getElementById('canvas-wrapper');
    svgWidth = wrapper.clientWidth;
    svgHeight = wrapper.clientHeight;

    svg.setAttribute('width', svgWidth);
    svg.setAttribute('height', svgHeight);

    // Initial zoom: 300 years visible on screen
    var totalYears = App.YEAR_END - App.YEAR_START;
    App.state.zoom = svgWidth / totalYears;
    App.state.panX = 0;

    // Build track label sidebar
    buildTrackLabels();

    // Handle resize
    window.addEventListener('resize', function () {
      var w = wrapper.clientWidth;
      var h = wrapper.clientHeight;
      if (w !== svgWidth || h !== svgHeight) {
        svgWidth = w;
        svgHeight = h;
        svg.setAttribute('width', svgWidth);
        svg.setAttribute('height', svgHeight);
        render();
      }
    });
  }

  function buildTrackLabels() {
    trackLabelsEl.innerHTML = '';
    var tracks = App.data.tracks;

    // Add axis spacer
    var spacer = document.createElement('div');
    spacer.style.height = AXIS_HEIGHT + 'px';
    spacer.style.flexShrink = '0';
    trackLabelsEl.appendChild(spacer);

    tracks.forEach(function (track) {
      var label = document.createElement('div');
      label.className = 'track-label';
      label.style.height = (TRACK_HEIGHT + TRACK_GAP) + 'px';
      label.style.color = track.color;
      label.innerHTML = track.name +
        '<span class="label-dot" style="background:' + track.color + '"></span>';

      label.addEventListener('click', function () {
        // Scroll to center this track (no-op for now, track is visible)
      });

      trackLabelsEl.appendChild(label);
    });
  }

  function getTrackY(trackIndex) {
    return AXIS_HEIGHT + trackIndex * (TRACK_HEIGHT + TRACK_GAP) + TRACK_HEIGHT / 2;
  }

  function render() {
    if (!App.data) return;

    clearLayers();

    var ppy = App.state.zoom; // pixels per year
    var panX = App.state.panX;
    var activeTag = App.state.activeTag;
    var levels = Layout.visibleLevels(ppy);

    drawGrid(ppy, panX);
    drawTracks(ppy, panX);
    drawEvents(ppy, panX, levels, activeTag);
  }

  function clearLayers() {
    gridLayer.innerHTML = '';
    arcsLayer.innerHTML = '';
    tracksLayer.innerHTML = '';
    eventsLayer.innerHTML = '';
    labelsLayer.innerHTML = '';
  }

  function drawGrid(ppy, panX) {
    // Determine grid interval based on zoom
    var yearsPerPixel = 1 / ppy;
    var interval;
    if (ppy < 0.5) interval = 100;
    else if (ppy < 2) interval = 50;
    else if (ppy < 5) interval = 25;
    else if (ppy < 10) interval = 10;
    else interval = 5;

    var visRange = Layout.visibleYearRange(panX, svgWidth, ppy);
    var startYear = Math.ceil(visRange.start / interval) * interval;

    for (var y = startYear; y <= visRange.end; y += interval) {
      var x = Layout.yearToX(y, panX, ppy);
      if (x < -2 || x > svgWidth + 2) continue;

      var isCentury = (y % 100 === 0);
      var line = makeSVG('line', {
        x1: x, y1: 0, x2: x, y2: svgHeight,
        class: isCentury ? 'grid-line-major' : 'grid-line',
      });
      gridLayer.appendChild(line);

      // Year label
      if (x > 10 && x < svgWidth - 10) {
        var text = makeSVG('text', {
          x: x, y: AXIS_HEIGHT - 8,
          class: 'year-label',
        });
        text.textContent = y;
        gridLayer.appendChild(text);
      }
    }
  }

  function drawTracks(ppy, panX) {
    var tracks = App.data.tracks;
    tracks.forEach(function (track, i) {
      var y = getTrackY(i);

      // Track background band
      var band = makeSVG('rect', {
        x: 0, y: y - TRACK_HEIGHT / 2,
        width: svgWidth, height: TRACK_HEIGHT,
        fill: track.color, class: 'track-band',
      });
      tracksLayer.appendChild(band);

      // Track center line
      var line = makeSVG('line', {
        x1: 0, y1: y, x2: svgWidth, y2: y,
        stroke: track.color, class: 'track-line',
      });
      tracksLayer.appendChild(line);
    });
  }

  function drawEvents(ppy, panX, levels, activeTag) {
    var tracks = App.data.tracks;
    var visRange = Layout.visibleYearRange(panX, svgWidth, ppy);

    tracks.forEach(function (track, trackIndex) {
      var trackY = getTrackY(trackIndex);
      var allEvents = App.data.events[track.id] || [];

      // Filter by visible levels
      var visibleEvents = allEvents.filter(function (e) {
        return levels.indexOf(e.level) !== -1 &&
               e.year >= visRange.start &&
               e.year <= visRange.end;
      });

      // Apply tag filter
      var filteredEvents = Layout.filterByTag(visibleEvents, activeTag);

      // Cluster non-level-1 nearby events
      var groups = Layout.clusterEvents(filteredEvents, ppy, panX);

      // Label layout for level 1 events
      var labelEvents = filteredEvents.filter(function (e) { return e.level === 1; });
      var labelPositions = Layout.layoutLabels(labelEvents, trackY, ppy, panX);
      var labelMap = {};
      labelPositions.forEach(function (lp) {
        labelMap[lp.event.id] = lp;
      });

      groups.forEach(function (group) {
        if (group.length === 1) {
          drawSingleEvent(group[0], track, trackY, ppy, panX, labelMap, activeTag, allEvents);
        } else {
          drawCluster(group, track, trackY, ppy, panX);
        }
      });

      // Draw faded dots for events not matching tag filter
      if (activeTag !== 'all') {
        var fadedEvents = visibleEvents.filter(function (e) {
          return !e.tags || e.tags.indexOf(activeTag) === -1;
        });
        fadedEvents.forEach(function (event) {
          var x = Layout.yearToX(event.year, panX, ppy);
          if (x < -20 || x > svgWidth + 20) return;
          var r = DOT_RADIUS[event.level] || 4;
          var dot = makeSVG('circle', {
            cx: x, cy: trackY, r: r,
            fill: track.color,
            class: 'event-dot faded',
          });
          eventsLayer.appendChild(dot);
        });
      }
    });
  }

  function drawSingleEvent(event, track, trackY, ppy, panX, labelMap, activeTag, allEvents) {
    var x = Layout.yearToX(event.year, panX, ppy);
    if (x < -20 || x > svgWidth + 20) return;

    var r = DOT_RADIUS[event.level] || 4;
    var dot = makeSVG('circle', {
      cx: x, cy: trackY, r: r,
      fill: track.color,
      class: 'event-dot',
      'data-id': event.id,
    });

    dot.addEventListener('mouseenter', function (e) {
      Tooltip.show(event, track, e);
    });
    dot.addEventListener('mousemove', function (e) {
      Tooltip.move(e);
    });
    dot.addEventListener('mouseleave', function () {
      Tooltip.hide();
    });
    dot.addEventListener('click', function () {
      showDetail(event, track, allEvents);
    });

    eventsLayer.appendChild(dot);

    // Draw duration bar for events with endYear
    if (event.endYear) {
      var x2 = Layout.yearToX(event.endYear, panX, ppy);
      var bar = makeSVG('rect', {
        x: x, y: trackY - 2,
        width: Math.max(x2 - x, 2), height: 4,
        fill: track.color, opacity: 0.25,
        rx: 2,
      });
      eventsLayer.insertBefore(bar, dot);
    }

    // Draw label for level 1 and 2 events with enough zoom
    if (event.level === 1 || (event.level === 2 && ppy > 1.5)) {
      var lp = labelMap[event.id];
      var labelY = lp ? lp.labelY : trackY - 16;

      var text = makeSVG('text', {
        x: x + r + 4,
        y: labelY,
        class: 'event-label level-' + event.level,
      });
      // Truncate long titles
      var title = event.title;
      if (title.length > 16 && ppy < 3) {
        title = title.substring(0, 14) + '…';
      }
      text.textContent = title;
      labelsLayer.appendChild(text);
    }
  }

  function drawCluster(group, track, trackY, ppy, panX) {
    // Place cluster at centroid year
    var sumYear = group.reduce(function (s, e) { return s + e.year; }, 0);
    var centroidYear = sumYear / group.length;
    var x = Layout.yearToX(centroidYear, panX, ppy);
    if (x < -20 || x > svgWidth + 20) return;

    var r = 10;
    var g = makeSVG('g', { class: 'event-cluster' });
    var circle = makeSVG('circle', { cx: x, cy: trackY, r: r });
    circle.style.fill = track.color;
    circle.style.fillOpacity = '0.4';
    circle.style.stroke = track.color;
    circle.style.strokeWidth = '1';

    var label = makeSVG('text', { x: x, y: trackY });
    label.textContent = group.length;

    g.appendChild(circle);
    g.appendChild(label);

    g.addEventListener('mouseenter', function (e) {
      Tooltip.showCluster(group, track, e);
    });
    g.addEventListener('mousemove', function (e) { Tooltip.move(e); });
    g.addEventListener('mouseleave', function () { Tooltip.hide(); });

    eventsLayer.appendChild(g);
  }

  function showDetail(event, track, allEvents) {
    App.state.selectedEvent = event;
    var panel = document.getElementById('detail-panel');
    var content = document.getElementById('detail-content');

    var yearStr = event.endYear
      ? event.year + '–' + event.endYear
      : event.year + ' 年';

    var tagsHtml = (event.tags || []).map(function (t) {
      return '<span class="detail-tag">' + t + '</span>';
    }).join('');

    var relatedHtml = '';
    if (event.related && event.related.length) {
      var relatedItems = event.related.map(function (rid) {
        // Find event across all tracks
        var found = null;
        Object.keys(App.data.events).forEach(function (tid) {
          App.data.events[tid].forEach(function (e) {
            if (e.id === rid) found = e;
          });
        });
        if (!found) return '';
        return '<span class="detail-related-item" data-event-id="' + rid + '">' +
               found.title + '</span>';
      }).join('');
      if (relatedItems) {
        relatedHtml = '<div class="detail-related">' +
          '<div class="detail-related-title">关联事件</div>' + relatedItems + '</div>';
      }
    }

    var detailHtml = '';
    if (event.detail) {
      detailHtml = '<div class="detail-detail">' + event.detail + '</div>';
    }

    content.innerHTML =
      '<div class="detail-year">' + yearStr + ' · ' + track.name + '</div>' +
      '<div class="detail-title">' + event.title + '</div>' +
      '<div class="detail-summary">' + event.summary + '</div>' +
      detailHtml +
      '<div class="detail-tags">' + tagsHtml + '</div>' +
      relatedHtml;

    // Wire up related event clicks
    content.querySelectorAll('.detail-related-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var eid = el.getAttribute('data-event-id');
        var found = null;
        var foundTrack = null;
        App.data.tracks.forEach(function (t) {
          (App.data.events[t.id] || []).forEach(function (e) {
            if (e.id === eid) { found = e; foundTrack = t; }
          });
        });
        if (found && foundTrack) {
          showDetail(found, foundTrack, App.data.events[foundTrack.id] || []);
          // Pan to that event
          var targetX = Layout.yearToX(found.year, App.state.panX, App.state.zoom);
          if (targetX < 50 || targetX > svgWidth - 50) {
            App.state.panX += svgWidth / 2 - targetX;
            render();
          }
        }
      });
    });

    panel.classList.remove('hidden');
  }

  // Utility: create SVG element with attributes
  function makeSVG(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    return el;
  }

  // Public: get track Y for a given index
  function getTrackYPublic(index) {
    return getTrackY(index);
  }

  return {
    init: init,
    render: render,
    getTrackY: getTrackYPublic,
    AXIS_HEIGHT: AXIS_HEIGHT,
    TRACK_HEIGHT: TRACK_HEIGHT,
    TRACK_GAP: TRACK_GAP,
  };
})();
