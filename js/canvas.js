/**
 * canvas.js — SVG rendering engine (v3 — dark theme + all fixes).
 *
 * Layout constants (all in px):
 *   TRACK_HEIGHT       = 160   (Fix 6: increased from 108 to 160)
 *   RULER_H            = 8
 *   TRACK_LINE_Y_OFFSET = 60   (center line from top of row)
 *   FIGURE_LANE_START  = TRACK_LINE_Y_OFFSET + 20  (first figure swim lane)
 *   FIGURE_LANE_H      = 8     (height of each lane bar)
 *   FIGURE_LANE_GAP    = 3     (gap between swim lanes)
 *   MAX_FIGURE_LANES   = 8
 */

var Canvas = (function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────────────────────

  var TRACK_HEIGHT        = 160;
  var RULER_H             = 8;
  var TRACK_LINE_Y_OFFSET = 60;   // from top of row to center line
  // Figure swim lanes start 14px below the center line (relative to track top + RULER_H)
  // Center line is at RULER_H + TRACK_LINE_Y_OFFSET = 68px from track top.
  // Lane area: 68 + 14 = 82px from top, up to 156px (leaving 4px margin).
  // Available: 74px → fits 6 lanes of 8px + 3px gap (11px each): 6*11 - 3 = 63px ✓
  var FIGURE_LANE_START   = TRACK_LINE_Y_OFFSET + 14;  // from RULER_H baseline
  var FIGURE_LANE_H       = 8;
  var FIGURE_LANE_GAP     = 3;
  var MAX_FIGURE_LANES    = 6;

  var DOT_R = { 1: 5, 2: 3.5, 3: 2 };

  // Fix 0: brighter track colors for dark background
  var TRACK_COLORS = {
    china:   '#e05c4f',  // warm red
    uk:      '#4f8ef7',  // blue
    france:  '#a78bfa',  // lavender
    usa:     '#4ade80',  // green
    russia:  '#fb923c',  // orange
    germany: '#94a3b8',  // slate-blue gray
    japan:   '#f472b6',  // pink
  };

  // Fix 5: category colors (vivid, dark-bg optimised)
  var CATEGORY_COLORS = {
    '政治':    '#ef4444',
    '军事':    '#f97316',
    '科学':    '#3b82f6',
    '文学':    '#a855f7',
    '音乐':    '#ec4899',
    '艺术':    '#f59e0b',
    '经济金融': '#10b981',
    '哲学思想': '#06b6d4',
  };

  // ─── State ────────────────────────────────────────────────────────────────

  var svg, svgW, svgH;
  var layerBands, layerRulers, layerGrid, layerFigures;
  var layerEvents, layerArcs, layerLabels, layerHover;
  var sidebar;
  var wrapper;
  var mainLayout;
  var axisCanvas, axisCtx;
  var raf = null;

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    svg        = document.getElementById('timeline-svg');
    wrapper    = document.getElementById('canvas-wrapper');
    sidebar    = document.getElementById('sidebar');
    mainLayout = document.getElementById('main-layout');
    axisCanvas = document.getElementById('axis-canvas');
    axisCtx    = axisCanvas.getContext('2d');

    layerBands   = document.getElementById('layer-bands');
    layerRulers  = document.getElementById('layer-rulers');
    layerGrid    = document.getElementById('layer-grid');
    layerFigures = document.getElementById('layer-figures');
    layerEvents  = document.getElementById('layer-events');
    layerArcs    = document.getElementById('layer-arcs');
    layerLabels  = document.getElementById('layer-labels');
    layerHover   = document.getElementById('layer-hover');

    updateSize();

    buildSidebar();

    wrapper.addEventListener('mousemove', onSVGMouseMove);
    wrapper.addEventListener('mouseleave', clearHoverBand);

    wrapper.addEventListener('click', function (e) {
      if (e.target === svg || e.target === wrapper) {
        Tooltip.hideDetail();
        clearArcs();
      }
    });

    // Fix 6: sync sidebar scroll with main-layout vertical scroll
    mainLayout.addEventListener('scroll', onVerticalScroll);

    window.addEventListener('resize', onResize);
  }

  function updateSize() {
    svgW = wrapper.clientWidth;
    // Fix 6: SVG height = total of all tracks (enables vertical scroll)
    var numTracks = App.data ? App.data.tracks.length : 7;
    svgH = numTracks * TRACK_HEIGHT;

    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);

    // Set explicit heights so the layout area scrolls
    var totalH = svgH;
    sidebar.style.height    = totalH + 'px';
    wrapper.style.height    = totalH + 'px';

    axisCanvas.width  = axisCanvas.parentElement.clientWidth;
    axisCanvas.height = axisCanvas.parentElement.clientHeight;

    // Initial zoom: fit all years in view
    if (App.state.zoom === 0) {
      App.state.zoom = svgW / (App.YEAR_END - App.YEAR_START);
      App.state.panX = 0;
    }
  }

  function onResize() {
    updateSize();
    buildSidebar();
    scheduleRender();
  }

  // Fix 6: keep sidebar labels visible during vertical scroll
  function onVerticalScroll() {
    // Labels are position:absolute within .sidebar which shares the same scroll
    // container — they naturally stay aligned. Nothing extra needed.
  }

  // ─── Sidebar (HTML labels) ────────────────────────────────────────────────

  function buildSidebar() {
    sidebar.innerHTML = '';
    var tracks = App.data.tracks;

    tracks.forEach(function (track, i) {
      var color = TRACK_COLORS[track.id] || track.color || '#888';
      var topY  = i * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET - 9;

      var label = document.createElement('div');
      label.className = 'sidebar-label';
      label.style.top    = topY + 'px';
      label.style.height = '18px';

      label.innerHTML =
        '<span class="sidebar-label-name" style="color:' + color + '">' + track.name + '</span>' +
        '<span class="sidebar-label-dot" style="background:' + color + '"></span>';

      sidebar.appendChild(label);
    });
  }

  // ─── Render orchestration ─────────────────────────────────────────────────

  function scheduleRender() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      raf = null;
      render();
    });
  }

  function render() {
    if (!App.data) return;

    var ppy  = App.state.zoom;
    var panX = App.state.panX;

    // Fix 1 + Fix 4: effective max level
    var effectiveMax = App.getEffectiveMaxLevel(ppy);
    var levels = [];
    for (var lv = 1; lv <= effectiveMax; lv++) levels.push(lv);

    var range = Layout.visibleRange(panX, svgW, ppy);

    clearAll();

    drawBands();
    drawRulerBars(ppy, panX, range);
    drawGrid(ppy, panX, range);
    drawFigureBars(ppy, panX, range);
    drawEvents(ppy, panX, levels, effectiveMax, range);
    drawAxisCanvas(ppy, panX);
    updateYearDisplay(ppy, panX);
  }

  function clearAll() {
    layerBands.innerHTML   = '';
    layerRulers.innerHTML  = '';
    layerGrid.innerHTML    = '';
    layerFigures.innerHTML = '';
    layerEvents.innerHTML  = '';
    layerArcs.innerHTML    = '';
    layerLabels.innerHTML  = '';
    // layerHover managed by mousemove
  }

  // ─── Track bands ─────────────────────────────────────────────────────────

  function drawBands() {
    var tracks = App.data.tracks;
    tracks.forEach(function (track, i) {
      var color = TRACK_COLORS[track.id] || track.color || '#888';
      // Fix 0: dark alternating fills
      var fill  = i % 2 === 0 ? '#0d0d0d' : '#111111';
      var y = i * TRACK_HEIGHT;

      var rect = mkSvg('rect', {
        x: 0, y: y, width: svgW, height: TRACK_HEIGHT,
        fill: fill, class: 'track-band',
      });
      layerBands.appendChild(rect);

      // Subtle separator
      var sepLine = mkSvg('line', {
        x1: 0, y1: y + TRACK_HEIGHT - 1, x2: svgW, y2: y + TRACK_HEIGHT - 1,
        stroke: 'rgba(255,255,255,0.05)', 'stroke-width': 1,
        class: 'track-center-line',
      });
      layerBands.appendChild(sepLine);

      // Center track line
      var lineY = y + RULER_H + TRACK_LINE_Y_OFFSET;
      var line = mkSvg('line', {
        x1: 0, y1: lineY, x2: svgW, y2: lineY,
        stroke: color, 'stroke-width': 1, opacity: 0.15,
        class: 'track-center-line',
      });
      layerBands.appendChild(line);
    });
  }

  // ─── Ruler bars ──────────────────────────────────────────────────────────

  function drawRulerBars(ppy, panX, range) {
    var tracks = App.data.tracks;

    tracks.forEach(function (track, i) {
      var rulers = track.rulers || [];
      var color  = TRACK_COLORS[track.id] || track.color || '#888';
      var y      = i * TRACK_HEIGHT;

      rulers.forEach(function (ruler) {
        var rStart = Math.max(ruler.startYear, range.start - 1);
        var rEnd   = Math.min(ruler.endYear,   range.end   + 1);
        if (rStart >= rEnd) return;

        var x1 = Layout.yearToX(rStart, panX, ppy);
        var x2 = Layout.yearToX(rEnd,   panX, ppy);
        if (x2 < -2 || x1 > svgW + 2) return;

        var rect = mkSvg('rect', {
          x: Math.max(x1, 0),
          y: y,
          width: Math.min(x2, svgW) - Math.max(x1, 0),
          height: RULER_H,
          fill: color,
          opacity: 0.5,
          rx: 3,
          class: 'ruler-bar-segment',
        });

        (function (r, t) {
          rect.addEventListener('mouseenter', function (e) {
            Tooltip.showRuler(r, t, e);
          });
          rect.addEventListener('mousemove', function (e) { Tooltip.move(e); });
          rect.addEventListener('mouseleave', function () { Tooltip.hide(); });
        })(ruler, track);

        layerRulers.appendChild(rect);

        var w = x2 - x1;
        if (w > 40) {
          var txtX = Math.max(x1 + 3, 3);
          var maxW = Math.min(x2, svgW) - txtX - 4;
          if (maxW > 20) {
            var txt = mkSvg('text', {
              x: txtX,
              y: y + RULER_H - 2,
              fill: 'rgba(255,255,255,0.85)',
              opacity: 1,
              'font-size': 7,
              'font-weight': 600,
              'font-family': 'Inter, sans-serif',
              'pointer-events': 'none',
              'text-anchor': 'start',
              'dominant-baseline': 'auto',
            });
            txt.textContent = truncateRulerName(ruler.name, maxW);
            layerRulers.appendChild(txt);
          }
        }
      });
    });
  }

  function truncateRulerName(name, maxPx) {
    var maxChars = Math.floor(maxPx / 5.5);
    if (name.length <= maxChars) return name;
    return name.substring(0, Math.max(2, maxChars - 1)) + '…';
  }

  // ─── Grid ────────────────────────────────────────────────────────────────

  function drawGrid(ppy, panX, range) {
    var intervals  = Layout.gridIntervals(ppy);
    var major      = intervals.major;
    var minor      = intervals.minor;
    var totalH     = App.data.tracks.length * TRACK_HEIGHT;

    // Minor gridlines
    var startMinor = Math.ceil(range.start / minor) * minor;
    for (var ym = startMinor; ym <= range.end; ym += minor) {
      if (ym % major === 0) continue;
      var xm = Layout.yearToX(ym, panX, ppy);
      if (xm < 0 || xm > svgW) continue;
      var lm = mkSvg('line', {
        x1: xm, y1: 0, x2: xm, y2: totalH,
        // Fix 0: dark grid
        stroke: 'rgba(255,255,255,0.03)', 'stroke-width': 0.5,
      });
      layerGrid.appendChild(lm);
    }

    // Major gridlines
    var startMajor = Math.ceil(range.start / major) * major;
    for (var y = startMajor; y <= range.end; y += major) {
      var x = Layout.yearToX(y, panX, ppy);
      if (x < 0 || x > svgW) continue;
      var isCentury = (y % 100 === 0);
      var line = mkSvg('line', {
        x1: x, y1: 0, x2: x, y2: totalH,
        // Fix 0: dark grid
        stroke: isCentury ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
        'stroke-width': isCentury ? 1 : 0.7,
      });
      layerGrid.appendChild(line);
    }
  }

  // ─── Fix 5: Figure bars with swim-lane layout ────────────────────────────

  function drawFigureBars(ppy, panX, range) {
    var activeCategory = App.state.activeCategory;
    if (!activeCategory || activeCategory === 'none') return;

    var catColor = CATEGORY_COLORS[activeCategory] ||
                   Tooltip.CATEGORY_COLORS[activeCategory] || '#888';
    var tracks = App.data.tracks;

    tracks.forEach(function (trackObj, i) {
      var allFigures = (App.data.figures[trackObj.id] || []).filter(function (f) {
        return f.category === activeCategory &&
               f.birthYear !== undefined;
      });

      if (!allFigures.length) return;

      var trackTop = i * TRACK_HEIGHT;

      // Fix 5: assign swim lanes
      var lanesAssigned = Layout.assignFigureLanes(allFigures);

      lanesAssigned.forEach(function (fig) {
        if (fig.lane >= MAX_FIGURE_LANES) return;

        var fStart = fig.birthYear;
        var fEnd   = fig.deathYear || (fig.birthYear + 10);

        // Skip if outside visible range
        if (fEnd < range.start - 1 || fStart > range.end + 1) return;

        var x1 = Layout.yearToX(Math.max(fStart, range.start - 1), panX, ppy);
        var x2 = Layout.yearToX(Math.min(fEnd,   range.end   + 1), panX, ppy);
        if (x2 < 0 || x1 > svgW) return;

        var barY = trackTop + RULER_H + FIGURE_LANE_START +
                   fig.lane * (FIGURE_LANE_H + FIGURE_LANE_GAP);

        // Cap bar to SVG boundaries
        var drawX1 = Math.max(x1, 0);
        var drawX2 = Math.min(x2, svgW);
        var barW   = drawX2 - drawX1;
        if (barW <= 0) return;

        var bar = mkSvg('rect', {
          x: drawX1,
          y: barY,
          width: barW,
          height: FIGURE_LANE_H,
          fill: catColor,
          opacity: 0.7,
          rx: 4,
          class: 'figure-bar',
        });

        // Inline name if bar is wide enough
        if (barW > 60) {
          var nameG = mkSvg('g', {});

          nameG.appendChild(bar);

          var label = mkSvg('text', {
            x: drawX1 + 5,
            y: barY + FIGURE_LANE_H / 2,
            fill: 'rgba(255,255,255,0.9)',
            'font-size': 9,
            'font-weight': 500,
            'font-family': 'Inter, sans-serif',
            'dominant-baseline': 'central',
            'pointer-events': 'none',
            'text-anchor': 'start',
          });
          var maxChars = Math.floor((barW - 10) / 6);
          label.textContent = truncateName(fig.name, maxChars);
          nameG.appendChild(label);

          // Tooltip events on the group
          (function (f, t) {
            nameG.addEventListener('mouseenter', function (e) {
              Tooltip.showFigure(f, t, e);
            });
            nameG.addEventListener('mousemove', function (e) { Tooltip.move(e); });
            nameG.addEventListener('mouseleave', function () { Tooltip.hide(); });
          })(fig, trackObj);

          layerFigures.appendChild(nameG);
        } else {
          (function (f, t) {
            bar.addEventListener('mouseenter', function (e) {
              Tooltip.showFigure(f, t, e);
            });
            bar.addEventListener('mousemove', function (e) { Tooltip.move(e); });
            bar.addEventListener('mouseleave', function () { Tooltip.hide(); });
          })(fig, trackObj);

          layerFigures.appendChild(bar);
        }
      });
    });
  }

  function truncateName(name, maxChars) {
    if (!name) return '';
    if (name.length <= maxChars) return name;
    return name.substring(0, Math.max(1, maxChars - 1)) + '…';
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  function drawEvents(ppy, panX, levels, effectiveMax, range) {
    var tracks     = App.data.tracks;
    var activeTag  = App.state.activeTag;
    var searchQ    = App.state.searchQuery;
    var selectedId = App.state.selectedEvent ? App.state.selectedEvent.id : null;

    tracks.forEach(function (track, i) {
      var color   = TRACK_COLORS[track.id] || track.color || '#888';
      var lineY   = i * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;
      var allEvts = App.data.events[track.id] || [];

      // Filter to visible year range and effective max level
      var inView = allEvts.filter(function (e) {
        return e.level <= effectiveMax &&
               e.year >= range.start &&
               e.year <= range.end;
      });

      var tagged   = Layout.filterByTag(inView, activeTag);
      var searched = searchQ ? Layout.filterBySearch(inView, searchQ) : null;

      // Draw faded dots for non-tag-matching events
      if (activeTag !== 'all') {
        var tagFaded = inView.filter(function (e) {
          return !e.tags || e.tags.indexOf(activeTag) === -1;
        });
        tagFaded.forEach(function (e) {
          var x = Layout.yearToX(e.year, panX, ppy);
          if (x < -10 || x > svgW + 10) return;
          var r  = DOT_R[e.level] || 3;
          var zoomOpacity = Layout.getEventOpacity(e.level, ppy);
          var dot = mkSvg('circle', {
            cx: x, cy: lineY, r: r,
            fill: color, opacity: 0.08 * zoomOpacity,
          });
          layerEvents.appendChild(dot);
        });
      }

      // Fix 3: cluster based on zoom
      var groups = Layout.clusterEvents(tagged, ppy, panX);

      // Label layout for L1 and L2 events
      var l1events = tagged.filter(function (e) { return e.level === 1; });
      var l2events = ppy > 2 ? tagged.filter(function (e) { return e.level === 2; }) : [];
      var labelEvts = l1events.concat(l2events);
      var labelMap = {};
      Layout.layoutLabels(labelEvts, lineY, ppy, panX, svgW).forEach(function (lp) {
        labelMap[lp.event.id] = lp;
      });

      groups.forEach(function (group) {
        var isSingleton = group.length === 1;

        if (isSingleton) {
          drawSingleEvent(group[0], track, color, lineY, ppy, panX,
                          labelMap, selectedId, searched, activeTag);
        } else {
          drawCluster(group, track, color, lineY, ppy, panX);
        }
      });
    });
  }

  function drawSingleEvent(ev, track, color, lineY, ppy, panX,
                           labelMap, selectedId, searched, activeTag) {
    var x = Layout.yearToX(ev.year, panX, ppy);
    if (x < -15 || x > svgW + 15) return;

    var r = DOT_R[ev.level] || 3;

    // Fix 4: zoom-level opacity transition
    var zoomOpacity = Layout.getEventOpacity(ev.level, ppy);
    if (zoomOpacity <= 0.01) return; // fully invisible — skip DOM node

    // Duration bar
    if (ev.endYear) {
      var x2   = Layout.yearToX(ev.endYear, panX, ppy);
      var barW  = Math.max(x2 - x, 2);
      var barH  = ev.level === 1 ? 4 : 3;
      var durBar = mkSvg('rect', {
        x: x, y: lineY - barH / 2,
        width: barW, height: barH,
        fill: color, opacity: 0.2 * zoomOpacity, rx: 1,
        class: 'event-duration-bar',
      });
      layerEvents.appendChild(durBar);
    }

    // Dot
    var dotOpacity = 1;
    if (searched !== null) {
      var inSearch = searched.some(function (s) { return s.id === ev.id; });
      if (!inSearch) dotOpacity = 0.08;
    }

    var isSelected = selectedId && ev.id === selectedId;

    // Fix 0: dark bg — dots are lighter fill, L1 has ring stroke
    var dotFillOpacity = ev.level === 1 ? 1 : ev.level === 2 ? 0.8 : 0.55;
    var finalOpacity   = dotOpacity * dotFillOpacity * zoomOpacity;

    var dot = mkSvg('circle', {
      cx: x, cy: lineY, r: r,
      fill: color,
      opacity: finalOpacity,
      class: 'event-dot',
      'stroke-width': ev.level === 1 ? 1.5 : 0,
      // Fix 0: use semi-transparent dark ring instead of pure white
      stroke: ev.level === 1 ? 'rgba(13,13,13,0.6)' : 'none',
      'data-id': ev.id,
    });

    if (isSelected) {
      dot.setAttribute('r', r * 1.6);
      dot.setAttribute('stroke', color);
      dot.setAttribute('stroke-width', 2.5);
      dot.setAttribute('fill', '#0d0d0d');
      dot.setAttribute('opacity', zoomOpacity);
    }

    dot.addEventListener('mouseenter', function (e) {
      Tooltip.show(ev, track, e);
    });
    dot.addEventListener('mousemove', function (e) { Tooltip.move(e); });
    dot.addEventListener('mouseleave', function () { Tooltip.hide(); });
    dot.addEventListener('click', function (e) {
      e.stopPropagation();
      Tooltip.hide();
      Tooltip.showDetail(ev, track);
    });

    layerEvents.appendChild(dot);

    // Label
    var lp = labelMap[ev.id];
    // Fix 3: only show label when label spacing is sufficient
    if (lp && lp.labelY !== null) {
      var titleShort = truncLabel(ev.title, ev.level, ppy);
      var fontSize   = ev.level === 1 ? 12 : 10;
      var fontWeight = ev.level === 1 ? 600 : 500;
      // Fix 0: dark bg label colors
      var fillColor  = ev.level === 1 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.65)';

      var labelOpacity = (searched !== null && dotOpacity < 0.5) ? 0.12 : zoomOpacity;

      var txt = mkSvg('text', {
        x: lp.x + r + 4,
        y: lp.labelY,
        fill: fillColor,
        opacity: labelOpacity,
        'font-size': fontSize,
        'font-weight': fontWeight,
        'font-family': 'Inter, -apple-system, sans-serif',
        class: 'event-label-text',
      });
      txt.textContent = titleShort;
      layerLabels.appendChild(txt);

      // Connector line
      if (lp.labelY < lineY - r - 4) {
        var connLine = mkSvg('line', {
          x1: lp.x, y1: lp.labelY + 2,
          x2: lp.x, y2: lineY - r - 1,
          stroke: color, 'stroke-width': 0.5, opacity: 0.25 * zoomOpacity,
          class: 'event-label-line',
        });
        layerLabels.appendChild(connLine);
      }
    }
  }

  function drawCluster(group, track, color, lineY, ppy, panX) {
    var sumY    = group.reduce(function (s, e) { return s + e.year; }, 0);
    var avgYear = sumY / group.length;
    var x = Layout.yearToX(avgYear, panX, ppy);
    if (x < -20 || x > svgW + 20) return;

    var r = 10;
    var g = mkSvg('g', { class: 'event-cluster-g' });

    // Fix 0: dark bg cluster circle
    var circle = mkSvg('circle', {
      cx: x, cy: lineY, r: r,
      fill: '#1a1a1a', opacity: 1,
      stroke: color, 'stroke-width': 1.5,
    });

    var label = mkSvg('text', {
      x: x, y: lineY,
      fill: color, 'font-size': 9,
      'font-weight': 600,
      'font-family': 'Inter, sans-serif',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'pointer-events': 'none',
    });
    label.textContent = group.length;

    g.appendChild(circle);
    g.appendChild(label);

    g.addEventListener('mouseenter', function (e) {
      Tooltip.showCluster(group, track, e);
    });
    g.addEventListener('mousemove', function (e) { Tooltip.move(e); });
    g.addEventListener('mouseleave', function () { Tooltip.hide(); });
    g.addEventListener('click', function (e) {
      e.stopPropagation();
      Tooltip.hide();
      Tooltip.showDetail(group[0], track);
    });

    layerEvents.appendChild(g);
  }

  // ─── Axis canvas ─────────────────────────────────────────────────────────

  function drawAxisCanvas(ppy, panX) {
    var ctx = axisCtx;
    var w   = axisCanvas.width;
    var h   = axisCanvas.height;

    ctx.clearRect(0, 0, w, h);
    // Fix 0: dark axis background
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, w, h);

    // Top border line
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, 0);
    ctx.stroke();

    var intervals  = Layout.gridIntervals(ppy);
    var major  = intervals.major;
    var minor  = intervals.minor;
    var range  = Layout.visibleRange(panX, w, ppy);

    // Minor ticks
    var startMinor = Math.ceil(range.start / minor) * minor;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 0.8;
    for (var ym = startMinor; ym <= range.end; ym += minor) {
      if (ym % major === 0) continue;
      var xm = Layout.yearToX(ym, panX, ppy);
      if (xm < 0 || xm > w) continue;
      ctx.beginPath();
      ctx.moveTo(xm, 4);
      ctx.lineTo(xm, 10);
      ctx.stroke();
    }

    // Major ticks + labels
    var startMajor = Math.ceil(range.start / major) * major;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = 1;
    ctx.fillStyle   = 'rgba(255,255,255,0.5)';
    ctx.font        = '500 11px Inter, sans-serif';
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'top';

    for (var y = startMajor; y <= range.end; y += major) {
      var x = Layout.yearToX(y, panX, ppy);
      if (x < 0 || x > w) continue;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 12);
      ctx.stroke();
      if (x > 22 && x < w - 22) {
        ctx.fillText(y, x, 14);
      }
    }
  }

  // ─── Year display ─────────────────────────────────────────────────────────

  function updateYearDisplay(ppy, panX) {
    var range = Layout.visibleRange(panX, svgW, ppy);
    var el = document.getElementById('year-range-display');
    if (el) {
      var s = Math.max(App.YEAR_START, Math.round(range.start));
      var e = Math.min(App.YEAR_END,   Math.round(range.end));
      el.textContent = s + ' \u2014 ' + e;
    }
  }

  // ─── Hover band ──────────────────────────────────────────────────────────

  function onSVGMouseMove(e) {
    var rect  = wrapper.getBoundingClientRect();
    var mx    = e.clientX - rect.left;
    var ppy   = App.state.zoom;
    var panX  = App.state.panX;
    var year  = Math.round(Layout.xToYear(mx, panX, ppy));
    var xSnap = Layout.yearToX(year, panX, ppy);

    layerHover.innerHTML = '';

    var totalH = App.data.tracks.length * TRACK_HEIGHT;
    var bandW  = Math.max(ppy * 1, 2);

    // Fix 0: dark hover band
    var band = mkSvg('rect', {
      x: xSnap - bandW / 2, y: 0,
      width: bandW, height: totalH,
      fill: 'rgba(255,255,255,0.03)',
      class: 'hover-band',
    });
    layerHover.appendChild(band);

    var vline = mkSvg('line', {
      x1: xSnap, y1: 0, x2: xSnap, y2: totalH,
      stroke: 'rgba(79,142,247,0.4)', 'stroke-width': 1,
      'pointer-events': 'none',
    });
    layerHover.appendChild(vline);

    // Year pill
    var labelW = 36;
    var labelH = 16;
    var pill = mkSvg('rect', {
      x: xSnap - labelW / 2, y: 2,
      width: labelW, height: labelH,
      rx: 4,
      fill: 'rgba(79,142,247,0.15)',
      'pointer-events': 'none',
    });
    layerHover.appendChild(pill);

    var txt = mkSvg('text', {
      x: xSnap, y: 10,
      fill: '#6ba3ff',
      'font-size': 10,
      'font-weight': 600,
      'font-family': 'Inter, sans-serif',
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      'pointer-events': 'none',
    });
    txt.textContent = year;
    layerHover.appendChild(txt);
  }

  function clearHoverBand() {
    layerHover.innerHTML = '';
  }

  // ─── Arc lines (related events) ──────────────────────────────────────────

  function drawRelatedArcs(event) {
    clearArcs();
    if (!event.related || !event.related.length) return;

    var ppy    = App.state.zoom;
    var panX   = App.state.panX;
    var tracks = App.data.tracks;

    var srcTrackIdx = -1;
    tracks.forEach(function (t, i) {
      if ((App.data.events[t.id] || []).some(function (e) { return e.id === event.id; })) {
        srcTrackIdx = i;
      }
    });

    if (srcTrackIdx < 0) return;

    var srcX = Layout.yearToX(event.year, panX, ppy);
    var srcY = srcTrackIdx * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;

    event.related.forEach(function (rid) {
      var res = Tooltip.findEvent(rid);
      if (!res) return;

      var relEvt   = res.event;
      var relTrack = res.track;
      var relIdx   = tracks.indexOf(relTrack);
      if (relIdx < 0) return;

      var tgtX  = Layout.yearToX(relEvt.year, panX, ppy);
      var tgtY  = relIdx * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;
      var color = TRACK_COLORS[relTrack.id] || relTrack.color || '#888';

      var dx  = tgtX - srcX;
      var dy  = tgtY - srcY;
      var cpX = (srcX + tgtX) / 2;
      var cpY = Math.min(srcY, tgtY) - Math.abs(dy) * 0.6 - Math.abs(dx) * 0.15;

      var path = mkSvg('path', {
        d: 'M ' + srcX + ' ' + srcY +
           ' Q ' + cpX + ' ' + cpY +
           ' ' + tgtX + ' ' + tgtY,
        stroke: color,
        'stroke-width': 1.2,
        opacity: 0.5,
        'stroke-dasharray': '5 3',
        fill: 'none',
        class: 'arc-path',
      });
      layerArcs.appendChild(path);

      var relDot = layerEvents.querySelector('[data-id="' + rid + '"]');
      if (relDot) {
        relDot.setAttribute('r', parseFloat(relDot.getAttribute('r') || 4) * 1.5);
        relDot.setAttribute('filter', 'url(#glow-filter)');
      }
    });
  }

  function clearArcs() {
    layerArcs.innerHTML = '';
  }

  // ─── Pan to year ─────────────────────────────────────────────────────────

  function panToYear(year) {
    var targetX = Layout.yearToX(year, App.state.panX, App.state.zoom);
    if (targetX < 60 || targetX > svgW - 60) {
      App.state.panX += svgW / 2 - targetX;
      Controls.clampPan();
      scheduleRender();
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  function mkSvg(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs).forEach(function (k) {
      el.setAttribute(k, attrs[k]);
    });
    return el;
  }

  function truncLabel(title, level, ppy) {
    var maxChars = level === 1 ? 12 : 8;
    if (ppy > 4)  maxChars = 20;
    if (ppy > 8)  maxChars = 40;
    if (!title || title.length <= maxChars) return title;
    return title.substring(0, maxChars - 1) + '…';
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    init:            init,
    render:          render,
    scheduleRender:  scheduleRender,
    drawRelatedArcs: drawRelatedArcs,
    clearArcs:       clearArcs,
    panToYear:       panToYear,
    TRACK_HEIGHT:    TRACK_HEIGHT,
    RULER_H:         RULER_H,
    TRACK_LINE_Y_OFFSET: TRACK_LINE_Y_OFFSET,
    TRACK_COLORS:    TRACK_COLORS,
    CATEGORY_COLORS: CATEGORY_COLORS,
    getSvgW:         function () { return svgW; },
    getSvgH:         function () { return svgH; },
  };
})();
