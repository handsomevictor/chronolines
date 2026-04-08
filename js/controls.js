/**
 * controls.js — Zoom / Pan interaction and Tag filter logic.
 */

var Controls = (function () {
  'use strict';

  var isDragging = false;
  var lastMouseX = 0;
  var wrapper;

  // Zoom config
  var ZOOM_MIN = 0.1;   // pixels per year
  var ZOOM_MAX = 40;
  var ZOOM_STEP = 1.25;

  function init() {
    wrapper = document.getElementById('canvas-wrapper');

    // Wheel zoom
    wrapper.addEventListener('wheel', onWheel, { passive: false });

    // Pan drag
    wrapper.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Touch support
    wrapper.addEventListener('touchstart', onTouchStart, { passive: true });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: true });

    // Zoom buttons
    document.getElementById('btn-zoom-in').addEventListener('click', function () {
      zoomAround(wrapper.clientWidth / 2, ZOOM_STEP);
    });
    document.getElementById('btn-zoom-out').addEventListener('click', function () {
      zoomAround(wrapper.clientWidth / 2, 1 / ZOOM_STEP);
    });
    document.getElementById('btn-zoom-reset').addEventListener('click', resetView);

    // Tag filter buttons
    document.querySelectorAll('.tag-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.tag-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        App.state.activeTag = btn.getAttribute('data-tag');
        Canvas.render();
      });
    });

    // Detail panel close
    document.getElementById('detail-close').addEventListener('click', function () {
      document.getElementById('detail-panel').classList.add('hidden');
      App.state.selectedEvent = null;
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', function (e) {
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
          document.getElementById('detail-panel').classList.add('hidden');
          break;
        case 'ArrowLeft':
          App.state.panX += 80;
          clampPan();
          Canvas.render();
          break;
        case 'ArrowRight':
          App.state.panX -= 80;
          clampPan();
          Canvas.render();
          break;
      }
    });
  }

  function onWheel(e) {
    e.preventDefault();
    var rect = wrapper.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
    zoomAround(mouseX, factor);
  }

  function zoomAround(pivotX, factor) {
    var oldZoom = App.state.zoom;
    var newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, oldZoom * factor));
    if (newZoom === oldZoom) return;

    // Adjust panX so the pivot point stays fixed
    var pivotYear = Layout.xToYear(pivotX, App.state.panX, oldZoom);
    App.state.zoom = newZoom;
    App.state.panX = pivotX - (pivotYear - App.YEAR_START) * newZoom;

    clampPan();
    Canvas.render();
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    isDragging = true;
    lastMouseX = e.clientX;
    wrapper.classList.add('dragging');
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    var dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;
    App.state.panX += dx;
    clampPan();
    Canvas.render();
  }

  function onMouseUp() {
    isDragging = false;
    wrapper.classList.remove('dragging');
  }

  // Touch support
  var touchStartX = 0;
  var lastTouchX = 0;
  var touchStartDist = 0;
  var touchStartZoom = 1;

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      lastTouchX = touchStartX;
    } else if (e.touches.length === 2) {
      touchStartDist = getTouchDist(e);
      touchStartZoom = App.state.zoom;
    }
  }

  function onTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
      var dx = e.touches[0].clientX - lastTouchX;
      lastTouchX = e.touches[0].clientX;
      App.state.panX += dx;
      clampPan();
      Canvas.render();
    } else if (e.touches.length === 2) {
      var dist = getTouchDist(e);
      var factor = dist / touchStartDist;
      var centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      var rect = wrapper.getBoundingClientRect();
      var pivotX = centerX - rect.left;
      var pivotYear = Layout.xToYear(pivotX, App.state.panX, App.state.zoom);
      App.state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, touchStartZoom * factor));
      App.state.panX = pivotX - (pivotYear - App.YEAR_START) * App.state.zoom;
      clampPan();
      Canvas.render();
    }
  }

  function onTouchEnd() { /* no-op */ }

  function getTouchDist(e) {
    var dx = e.touches[0].clientX - e.touches[1].clientX;
    var dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function clampPan() {
    var svgWidth = wrapper.clientWidth;
    var totalWidth = (App.YEAR_END - App.YEAR_START) * App.state.zoom;
    // Don't allow panning past the start or end of the timeline
    var maxPan = svgWidth * 0.1;
    var minPan = svgWidth - totalWidth - svgWidth * 0.1;
    App.state.panX = Math.min(maxPan, Math.max(minPan, App.state.panX));
  }

  function resetView() {
    var svgWidth = wrapper.clientWidth;
    App.state.zoom = svgWidth / (App.YEAR_END - App.YEAR_START);
    App.state.panX = 0;
    Canvas.render();
  }

  return {
    init: init,
    resetView: resetView,
  };
})();
