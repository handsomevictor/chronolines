/**
 * controls.js — Zoom / Pan interactions, tag/category filters, search.
 */

var Controls = (function () {
  'use strict';

  var wrapper;
  var isDragging  = false;
  var lastMouseX  = 0;

  // Touch state
  var touch1LastX    = 0;
  var touchStartDist = 0;
  var touchStartZoom = 1;
  var touchStartPanX = 0;

  // Zoom bounds
  var ZOOM_MIN  = 0.08;  // full timeline on screen
  var ZOOM_MAX  = 50;    // ~10 year view
  var ZOOM_STEP = 1.25;

  function init() {
    wrapper = document.getElementById('canvas-wrapper');

    // ── Zoom / Pan ────────────────────────────────────────────────────────
    wrapper.addEventListener('wheel', onWheel, { passive: false });
    wrapper.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);

    // Touch
    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchmove',  onTouchMove,  { passive: false });
    wrapper.addEventListener('touchend',   onTouchEnd,   { passive: true });

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', function () {
      zoomAround(wrapper.clientWidth / 2, ZOOM_STEP);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', function () {
      zoomAround(wrapper.clientWidth / 2, 1 / ZOOM_STEP);
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', resetView);

    // ── Tag filter ────────────────────────────────────────────────────────
    document.querySelectorAll('.tag-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tag-chip').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        App.state.activeTag = btn.getAttribute('data-tag');
        syncURL();
        Canvas.scheduleRender();
      });
    });

    // ── Category filter (figures) ─────────────────────────────────────────
    document.querySelectorAll('.cat-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.cat-chip').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        App.state.activeCategory = btn.getAttribute('data-category');
        Canvas.scheduleRender();
      });
    });

    // ── Search ────────────────────────────────────────────────────────────
    var searchInput = document.getElementById('search-input');
    var searchTimer = null;
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        App.state.searchQuery = searchInput.value.trim();
        Canvas.scheduleRender();
      }, 150);
    });

    // ── Detail panel close ─────────────────────────────────────────────────
    document.getElementById('detail-close').addEventListener('click', function () {
      Tooltip.hideDetail();
    });

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    window.addEventListener('keydown', function (e) {
      // Ignore when focused on input
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

      switch (e.key) {
        case '+':
        case '=':
          zoomAround(wrapper.clientWidth / 2, ZOOM_STEP);
          break;
        case '-':
          zoomAround(wrapper.clientWidth / 2, 1 / ZOOM_STEP);
          break;
        case '0':
          resetView();
          break;
        case 'Escape':
          Tooltip.hideDetail();
          break;
        case 'ArrowLeft':
          App.state.panX += 80;
          clampPan();
          Canvas.scheduleRender();
          break;
        case 'ArrowRight':
          App.state.panX -= 80;
          clampPan();
          Canvas.scheduleRender();
          break;
      }
    });

    // ── URL state restore ─────────────────────────────────────────────────
    restoreFromURL();
  }

  // ─── Wheel zoom ──────────────────────────────────────────────────────────

  function onWheel(e) {
    e.preventDefault();
    var rect   = wrapper.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    // Normalize delta across different browsers / platforms
    var delta  = e.deltaY || e.detail || -e.wheelDelta;
    var factor = delta < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAround(mouseX, factor);
  }

  function zoomAround(pivotX, factor) {
    var oldZoom = App.state.zoom;
    var newZoom = clamp(oldZoom * factor, ZOOM_MIN, ZOOM_MAX);
    if (newZoom === oldZoom) return;

    // Keep the pivot year fixed
    var pivotYear   = Layout.xToYear(pivotX, App.state.panX, oldZoom);
    App.state.zoom  = newZoom;
    App.state.panX  = pivotX - (pivotYear - App.YEAR_START) * newZoom;

    clampPan();
    syncURL();
    Canvas.scheduleRender();
  }

  // ─── Mouse drag ──────────────────────────────────────────────────────────

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging  = true;
    lastMouseX  = e.clientX;
    wrapper.classList.add('dragging');
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    var dx       = e.clientX - lastMouseX;
    lastMouseX   = e.clientX;
    App.state.panX += dx;
    clampPan();
    Canvas.scheduleRender();
  }

  function onMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    wrapper.classList.remove('dragging');
    syncURL();
  }

  // ─── Touch ──────────────────────────────────────────────────────────────

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touch1LastX  = e.touches[0].clientX;
    } else if (e.touches.length === 2) {
      touchStartDist = touchDist(e);
      touchStartZoom = App.state.zoom;
      touchStartPanX = App.state.panX;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var dx = e.touches[0].clientX - touch1LastX;
      touch1LastX = e.touches[0].clientX;
      App.state.panX += dx;
      clampPan();
      Canvas.scheduleRender();
    } else if (e.touches.length === 2) {
      var dist   = touchDist(e);
      var factor = dist / touchStartDist;
      var cx     = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var rect   = wrapper.getBoundingClientRect();
      var pivotX = cx - rect.left;
      var pivotYear = Layout.xToYear(pivotX, touchStartPanX, touchStartZoom);
      var newZoom   = clamp(touchStartZoom * factor, ZOOM_MIN, ZOOM_MAX);
      App.state.zoom = newZoom;
      App.state.panX = pivotX - (pivotYear - App.YEAR_START) * newZoom;
      clampPan();
      Canvas.scheduleRender();
    }
  }

  function onTouchEnd() { syncURL(); }

  function touchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ─── Pan clamping ─────────────────────────────────────────────────────────

  function clampPan() {
    var w         = wrapper.clientWidth || window.innerWidth;
    var totalW    = (App.YEAR_END - App.YEAR_START) * App.state.zoom;
    var overscroll = w * 0.1;
    var maxPan    = overscroll;
    var minPan    = w - totalW - overscroll;
    App.state.panX = clamp(App.state.panX, minPan, maxPan);
  }

  // ─── Reset ───────────────────────────────────────────────────────────────

  function resetView() {
    var w = wrapper.clientWidth || window.innerWidth;
    App.state.zoom = w / (App.YEAR_END - App.YEAR_START);
    App.state.panX = 0;
    syncURL();
    Canvas.scheduleRender();
  }

  // ─── URL sync ────────────────────────────────────────────────────────────

  function syncURL() {
    if (!window.history || !window.history.replaceState) return;
    try {
      var ppy   = App.state.zoom;
      var panX  = App.state.panX;
      var range = Layout.visibleRange(panX, Canvas.getSvgW(), ppy);
      var s     = Math.max(App.YEAR_START, Math.round(range.start));
      var e     = Math.min(App.YEAR_END,   Math.round(range.end));

      var params = new URLSearchParams();
      params.set('years', s + '-' + e);
      if (App.state.activeTag && App.state.activeTag !== 'all') {
        params.set('tag', App.state.activeTag);
      }
      window.history.replaceState(null, '', '?' + params.toString());
    } catch (err) { /* ignore */ }
  }

  function restoreFromURL() {
    try {
      var params = new URLSearchParams(window.location.search);

      // Restore tag
      var tag = params.get('tag');
      if (tag) {
        App.state.activeTag = tag;
        document.querySelectorAll('.tag-chip').forEach(function (btn) {
          btn.classList.toggle('active', btn.getAttribute('data-tag') === tag);
        });
      }

      // Restore year range
      var years = params.get('years');
      if (years) {
        var parts = years.split('-');
        if (parts.length === 2) {
          var startY = parseInt(parts[0], 10);
          var endY   = parseInt(parts[1], 10);
          if (!isNaN(startY) && !isNaN(endY) && endY > startY) {
            var w = wrapper ? wrapper.clientWidth : window.innerWidth;
            App.state.zoom = w / (endY - startY);
            App.state.panX = -(startY - App.YEAR_START) * App.state.zoom;
            clampPan();
          }
        }
      }
    } catch (err) { /* ignore */ }
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  return {
    init:      init,
    resetView: resetView,
    clampPan:  clampPan,
    zoomAround: zoomAround,
  };
})();
