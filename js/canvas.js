/**
 * canvas.js — SVG rendering engine.
 *
 * Layout constants (all in px):
 *   TRACK_HEIGHT   = 108  (total height per track row)
 *   RULER_H        = 8    (ruler bar at top of each row)
 *   TRACK_LINE_Y   = RULER_H + 54   (center line within row)
 *
 * The SVG origin (0,0) maps to the top-left of the canvas-wrapper.
 * Sidebar labels are HTML divs absolutely positioned in .sidebar,
 * so their top = trackIndex * TRACK_HEIGHT + TRACK_HEIGHT/2 - 9 (center text).
 */

var Canvas = (function () {
  'use strict';

  // ─── Constants ─────────────────────────────────────────────────────────────

  var TRACK_HEIGHT = 108;   // px, total height per track row
  var RULER_H      = 8;     // px, ruler bar height at top of row
  var TRACK_LINE_Y_OFFSET = RULER_H + 50;  // from top of row to center line

  var DOT_R = { 1: 5, 2: 3.5, 3: 2 };

  var TRACK_COLORS = {
    china:   '#c0392b',   // deep red
    uk:      '#1a5276',   // deep ocean blue
    france:  '#6c3483',   // deep purple
    usa:     '#1e8449',   // deep green
    russia:  '#b7770d',   // dark gold
    germany: '#515a5a',   // deep gray
    japan:   '#922b21',   // deep rose-red
  };

  // ─── State ────────────────────────────────────────────────────────────────

  var svg, svgW, svgH;
  var layerBands, layerRulers, layerGrid, layerFigures;
  var layerEvents, layerArcs, layerLabels, layerHover;
  var sidebar;
  var wrapper;
  var axisCanvas, axisCtx;
  var raf = null;

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    svg        = document.getElementById('timeline-svg');
    wrapper    = document.getElementById('canvas-wrapper');
    sidebar    = document.getElementById('sidebar');
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

    // Build sidebar labels
    buildSidebar();

    // SVG mousemove → hover band + year indicator
    wrapper.addEventListener('mousemove', onSVGMouseMove);
    wrapper.addEventListener('mouseleave', clearHoverBand);

    // Click on blank area → close detail
    wrapper.addEventListener('click', function (e) {
      if (e.target === svg || e.target === wrapper) {
        Tooltip.hideDetail();
        clearArcs();
      }
    });

    window.addEventListener('resize', onResize);
  }

  function updateSize() {
    svgW = wrapper.clientWidth;
    svgH = wrapper.clientHeight;
    svg.setAttribute('width', svgW);
    svg.setAttribute('height', svgH);
    axisCanvas.width  = axisCanvas.parentElement.clientWidth;
    axisCanvas.height = axisCanvas.parentElement.clientHeight;

    // Initial zoom: fit 1700-2000 in view
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

  // ─── Sidebar (HTML labels) ────────────────────────────────────────────────

  function buildSidebar() {
    sidebar.innerHTML = '';
    var tracks = App.data.tracks;

    tracks.forEach(function (track, i) {
      var color = TRACK_COLORS[track.id] || track.color || '#888';
      var topY  = i * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET - 9;  // center text on line

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

    var ppy    = App.state.zoom;
    var panX   = App.state.panX;
    var levels = Layout.visibleLevels(ppy);
    var range  = Layout.visibleRange(panX, svgW, ppy);

    clearAll();

    drawBands();
    drawRulerBars(ppy, panX, range);
    drawGrid(ppy, panX, range);
    drawFigureBars(ppy, panX, range);
    drawEvents(ppy, panX, levels, range);
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
    // layerHover is managed by mousemove
  }

  // ─── Track bands ─────────────────────────────────────────────────────────

  function drawBands() {
    var tracks = App.data.tracks;
    tracks.forEach(function (track, i) {
      var y     = i * TRACK_HEIGHT;
      var color = TRACK_COLORS[track.id] || track.color || '#888';
      var fill  = i % 2 === 0 ? '#ffffff' : 'rgba(246,245,244,0.65)';

      var rect = mkSvg('rect', {
        x: 0, y: y, width: svgW, height: TRACK_HEIGHT,
        fill: fill, class: 'track-band',
      });
      layerBands.appendChild(rect);

      // Subtle bottom separator line
      var sepLine = mkSvg('line', {
        x1: 0, y1: y + TRACK_HEIGHT - 1, x2: svgW, y2: y + TRACK_HEIGHT - 1,
        stroke: 'rgba(0,0,0,0.06)', 'stroke-width': 1,
        class: 'track-center-line',
      });
      layerBands.appendChild(sepLine);

      // Center track line
      var lineY = y + RULER_H + TRACK_LINE_Y_OFFSET;
      var line = mkSvg('line', {
        x1: 0, y1: lineY, x2: svgW, y2: lineY,
        stroke: color, 'stroke-width': 1, opacity: 0.25,
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
          opacity: 0.3,
          rx: 3,
          class: 'ruler-bar-segment',
        });

        // Hover → tooltip
        (function (r, t) {
          rect.addEventListener('mouseenter', function (e) {
            Tooltip.showRuler(r, t, e);
          });
          rect.addEventListener('mousemove', function (e) { Tooltip.move(e); });
          rect.addEventListener('mouseleave', function () { Tooltip.hide(); });
        })(ruler, track);

        layerRulers.appendChild(rect);

        // Ruler name label (only when wide enough)
        var w = x2 - x1;
        if (w > 40) {
          var txtX = Math.max(x1 + 3, 3);
          var maxW = Math.min(x2, svgW) - txtX - 4;
          if (maxW > 20) {
            var txt = mkSvg('text', {
              x: txtX,
              y: y + RULER_H - 2,
              fill: '#ffffff',
              opacity: 0.9,
              'font-size': 7,
              'font-weight': 600,
              'font-family': 'Inter, sans-serif',
              'pointer-events': 'none',
              'text-anchor': 'start',
              'dominant-baseline': 'auto',
            });
            var shortName = truncateRulerName(ruler.name, maxW);
            txt.textContent = shortName;
            layerRulers.appendChild(txt);
          }
        }
      });
    });
  }

  function truncateRulerName(name, maxPx) {
    // ~6px per character at font-size 8
    var maxChars = Math.floor(maxPx / 5.5);
    if (name.length <= maxChars) return name;
    return name.substring(0, Math.max(2, maxChars - 1)) + '…';
  }

  // ─── Grid ────────────────────────────────────────────────────────────────

  function drawGrid(ppy, panX, range) {
    var intervals = Layout.gridIntervals(ppy);
    var major = intervals.major;
    var minor = intervals.minor;

    var startMajor = Math.ceil(range.start / major) * major;
    var totalH     = App.data.tracks.length * TRACK_HEIGHT;

    // Minor gridlines
    var startMinor = Math.ceil(range.start / minor) * minor;
    for (var ym = startMinor; ym <= range.end; ym += minor) {
      if (ym % major === 0) continue;
      var xm = Layout.yearToX(ym, panX, ppy);
      if (xm < 0 || xm > svgW) continue;
      var lm = mkSvg('line', {
        x1: xm, y1: 0, x2: xm, y2: totalH,
        stroke: 'rgba(0,0,0,0.04)', 'stroke-width': 0.5,
      });
      layerGrid.appendChild(lm);
    }

    // Major gridlines + labels on grid
    for (var y = startMajor; y <= range.end; y += major) {
      var x = Layout.yearToX(y, panX, ppy);
      if (x < 0 || x > svgW) continue;

      var isCentury = (y % 100 === 0);
      var line = mkSvg('line', {
        x1: x, y1: 0, x2: x, y2: totalH,
        stroke: isCentury ? 'rgba(0,0,0,0.14)' : 'rgba(0,0,0,0.07)',
        'stroke-width': isCentury ? 1 : 0.7,
      });
      layerGrid.appendChild(line);
    }
  }

  // ─── Figure bars ─────────────────────────────────────────────────────────

  function drawFigureBars(ppy, panX, range) {
    var activeCategory = App.state.activeCategory;
    if (!activeCategory || activeCategory === 'none') return;

    var catColor = Tooltip.CATEGORY_COLORS[activeCategory] || '#888';
    var tracks = App.data.tracks;

    tracks.forEach(function (track, i) {
      var figures = (App.data.figures[track.id] || []).filter(function (f) {
        return f.category === activeCategory &&
               f.birthYear !== undefined &&
               f.deathYear !== undefined;
      });

      var lineY = i * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;

      figures.forEach(function (fig) {
        var fStart = Math.max(fig.birthYear, range.start - 1);
        var fEnd   = Math.min(fig.deathYear, range.end   + 1);
        if (fStart >= fEnd) return;

        var x1 = Layout.yearToX(fStart, panX, ppy);
        var x2 = Layout.yearToX(fEnd,   panX, ppy);
        if (x2 < 0 || x1 > svgW) return;

        var barH  = 6;
        var barY  = lineY + 12;

        var bar = mkSvg('rect', {
          x: Math.max(x1, 0),
          y: barY,
          width: Math.min(x2, svgW) - Math.max(x1, 0),
          height: barH,
          fill: catColor,
          opacity: 0.35,
          rx: 3,
          class: 'figure-bar',
        });

        (function (f, t) {
          bar.addEventListener('mouseenter', function (e) {
            Tooltip.showFigure(f, t, e);
          });
          bar.addEventListener('mousemove', function (e) { Tooltip.move(e); });
          bar.addEventListener('mouseleave', function () { Tooltip.hide(); });
        })(fig, track);

        layerFigures.appendChild(bar);
      });
    });
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  function drawEvents(ppy, panX, levels, range) {
    var tracks     = App.data.tracks;
    var activeTag  = App.state.activeTag;
    var searchQ    = App.state.searchQuery;
    var selectedId = App.state.selectedEvent ? App.state.selectedEvent.id : null;

    tracks.forEach(function (track, i) {
      var color    = TRACK_COLORS[track.id] || track.color || '#888';
      var lineY    = i * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;
      var allEvts  = App.data.events[track.id] || [];

      // Filter to visible year range and levels
      var inView = allEvts.filter(function (e) {
        return levels.indexOf(e.level) !== -1 &&
               e.year >= range.start &&
               e.year <= range.end;
      });

      // Tag-matching events (or all if 'all')
      var tagged = Layout.filterByTag(inView, activeTag);

      // Search-matching events
      var searched = searchQ ? Layout.filterBySearch(inView, searchQ) : null;

      // Draw faded dots for non-matching events (tag filter)
      if (activeTag !== 'all') {
        var tagFaded = inView.filter(function (e) {
          return !e.tags || e.tags.indexOf(activeTag) === -1;
        });
        tagFaded.forEach(function (e) {
          var x = Layout.yearToX(e.year, panX, ppy);
          if (x < -10 || x > svgW + 10) return;
          var r  = DOT_R[e.level] || 3;
          var dot = mkSvg('circle', {
            cx: x, cy: lineY, r: r,
            fill: color, opacity: 0.12,
          });
          layerEvents.appendChild(dot);
        });
      }

      // Cluster active events
      var groups = Layout.clusterEvents(tagged, ppy, panX);

      // Level-1 label layout (for label collision)
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
          var ev = group[0];
          drawSingleEvent(ev, track, color, lineY, ppy, panX,
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

    // Duration bar
    if (ev.endYear) {
      var x2   = Layout.yearToX(ev.endYear, panX, ppy);
      var barW  = Math.max(x2 - x, 2);
      var barH  = ev.level === 1 ? 4 : 3;
      var durBar = mkSvg('rect', {
        x: x, y: lineY - barH / 2,
        width: barW, height: barH,
        fill: color, opacity: 0.2, rx: 1,
        class: 'event-duration-bar',
      });
      layerEvents.appendChild(durBar);
    }

    // Dot
    var classes = 'event-dot';
    var dotOpacity = 1;

    if (searched !== null) {
      var inSearch = searched.some(function (s) { return s.id === ev.id; });
      if (!inSearch) { dotOpacity = 0.1; }
    }

    var isSelected = selectedId && ev.id === selectedId;

    var dotFillOpacity = ev.level === 1 ? 1 : ev.level === 2 ? 0.7 : 0.45;
    var dot = mkSvg('circle', {
      cx: x, cy: lineY, r: r,
      fill: color,
      opacity: dotOpacity * dotFillOpacity,
      class: classes,
      'stroke-width': ev.level === 1 ? 2 : 0,
      stroke: ev.level === 1 ? '#ffffff' : 'none',
      'data-id': ev.id,
    });

    if (isSelected) {
      dot.setAttribute('r', r * 1.6);
      dot.setAttribute('stroke', color);
      dot.setAttribute('stroke-width', 3);
      dot.setAttribute('fill', '#ffffff');
    }

    // Events
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
    if (lp && lp.labelY !== null) {
      var titleShort = truncLabel(ev.title, ev.level, ppy);
      var fontSize   = ev.level === 1 ? 12 : 10;
      var fontWeight = ev.level === 1 ? 600 : 500;
      var fillColor  = ev.level === 1 ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)';

      var labelOpacity = (searched !== null && dotOpacity < 0.5) ? 0.15 : 1;

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

      // Connector line: from label bottom to dot
      if (lp.labelY < lineY - r - 4) {
        var connLine = mkSvg('line', {
          x1: lp.x, y1: lp.labelY + 2,
          x2: lp.x, y2: lineY - r - 1,
          stroke: color, 'stroke-width': 0.5, opacity: 0.3,
          class: 'event-label-line',
        });
        layerLabels.appendChild(connLine);
      }
    }
  }

  function drawCluster(group, track, color, lineY, ppy, panX) {
    // Center cluster on average year
    var sumY = group.reduce(function (s, e) { return s + e.year; }, 0);
    var avgYear = sumY / group.length;
    var x = Layout.yearToX(avgYear, panX, ppy);
    if (x < -20 || x > svgW + 20) return;

    var r = 10;
    var g = mkSvg('g', { class: 'event-cluster-g' });

    var circle = mkSvg('circle', {
      cx: x, cy: lineY, r: r,
      fill: '#ffffff', opacity: 1,
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
      // Show detail for first event in cluster
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
    ctx.fillStyle = '#f6f5f4';
    ctx.fillRect(0, 0, w, h);

    var intervals = Layout.gridIntervals(ppy);
    var major  = intervals.major;
    var minor  = intervals.minor;
    var range  = Layout.visibleRange(panX, w, ppy);

    // Minor ticks
    var startMinor = Math.ceil(range.start / minor) * minor;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
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
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth   = 1;
    ctx.fillStyle   = '#615d59';
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

    // Clear previous hover band
    layerHover.innerHTML = '';

    var totalH = App.data.tracks.length * TRACK_HEIGHT;
    var bandW  = Math.max(ppy * 1, 2);

    var band = mkSvg('rect', {
      x: xSnap - bandW / 2, y: 0,
      width: bandW, height: totalH,
      fill: 'rgba(0,117,222,0.04)',
      class: 'hover-band',
    });
    layerHover.appendChild(band);

    // Vertical hairline
    var vline = mkSvg('line', {
      x1: xSnap, y1: 0, x2: xSnap, y2: totalH,
      stroke: 'rgba(0,117,222,0.25)', 'stroke-width': 1,
      'pointer-events': 'none',
    });
    layerHover.appendChild(vline);

    // Year label at top — pill background
    var labelW = 36;
    var labelH = 16;
    var pill = mkSvg('rect', {
      x: xSnap - labelW / 2, y: 2,
      width: labelW, height: labelH,
      rx: 4,
      fill: 'rgba(0,117,222,0.1)',
      'pointer-events': 'none',
    });
    layerHover.appendChild(pill);

    var txt = mkSvg('text', {
      x: xSnap, y: 10,
      fill: '#005bab',
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

    // Find source track index
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

      var tgtX = Layout.yearToX(relEvt.year, panX, ppy);
      var tgtY = relIdx * TRACK_HEIGHT + RULER_H + TRACK_LINE_Y_OFFSET;
      var color = TRACK_COLORS[relTrack.id] || relTrack.color || '#888';

      // SVG quadratic bezier arc
      var dx    = tgtX - srcX;
      var dy    = tgtY - srcY;
      var cpX   = (srcX + tgtX) / 2;
      var cpY   = Math.min(srcY, tgtY) - Math.abs(dy) * 0.6 - Math.abs(dx) * 0.15;

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

      // Highlight the related dot
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
    if (ppy > 4) maxChars = 20;
    if (ppy > 8) maxChars = 40;
    if (!title || title.length <= maxChars) return title;
    return title.substring(0, maxChars - 1) + '…';
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  return {
    init:           init,
    render:         render,
    scheduleRender: scheduleRender,
    drawRelatedArcs: drawRelatedArcs,
    clearArcs:      clearArcs,
    panToYear:      panToYear,
    TRACK_HEIGHT:   TRACK_HEIGHT,
    RULER_H:        RULER_H,
    TRACK_LINE_Y_OFFSET: TRACK_LINE_Y_OFFSET,
    TRACK_COLORS:   TRACK_COLORS,
    getSvgW:        function () { return svgW; },
    getSvgH:        function () { return svgH; },
  };
})();
