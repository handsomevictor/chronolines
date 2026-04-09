/**
 * main.js — Entry point for Chronolines v3.
 * Loads data.json and bootstraps all modules.
 * Adds userMaxLevel state for Level selector (Fix 1).
 * Adds trackOrder state with localStorage persistence and drag-sort support.
 */

(function () {
  'use strict';

  // Default track order (germany and russia swapped vs data.json)
  var DEFAULT_TRACK_ORDER = ['china', 'uk', 'france', 'usa', 'germany', 'russia', 'japan'];

  // ─── Global app state ───────────────────────────────────────────────────────
  window.App = {
    data: null,

    state: {
      zoom:           0,      // pixels per year (0 = not yet set)
      panX:           0,      // horizontal pixel offset
      activeTag:      'all',  // tag filter
      activeCategory: 'none', // figure category filter
      figureSize:     'M',   // figure lane size: 'S' | 'M' | 'L'
      searchQuery:    '',     // search string
      selectedEvent:  null,   // currently selected event object
      userMaxLevel:   3,      // Fix 1: user-selected max level (1/2/3)
      trackOrder:     null,   // array of track ids in display order
    },

    YEAR_START: 1700,
    YEAR_END:   2025,

    /**
     * Fix 1 + Fix 4: effective max level = min(zoomLevel, userMaxLevel).
     * Called by canvas.js when deciding which events to draw.
     */
    getEffectiveMaxLevel: function (pixelsPerYear) {
      var zoomMax = Layout.getZoomMaxLevel(pixelsPerYear);
      return Math.min(zoomMax, App.state.userMaxLevel);
    },

    /**
     * Return tracks array sorted by App.state.trackOrder.
     * Falls back to App.data.tracks order if trackOrder is not set.
     */
    getOrderedTracks: function () {
      if (!App.data) return [];
      var order = App.state.trackOrder;
      if (!order || !order.length) return App.data.tracks.slice();
      var trackMap = {};
      App.data.tracks.forEach(function (t) { trackMap[t.id] = t; });
      var result = [];
      order.forEach(function (id) {
        if (trackMap[id]) result.push(trackMap[id]);
      });
      // Append any tracks not in order (safety net)
      App.data.tracks.forEach(function (t) {
        if (order.indexOf(t.id) === -1) result.push(t);
      });
      return result;
    },
  };

  // ─── Bootstrap ──────────────────────────────────────────────────────────────

  function init() {
    fetch('js/data.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        App.data = data;
        if (data._meta) {
          console.info(
            '[Chronolines] loaded',
            data._meta.total_events, 'events,',
            data._meta.total_figures, 'figures'
          );
        }
        onReady();
      })
      .catch(function (err) {
        showError(err.message);
      });
  }

  // ─── Track order: load from localStorage or use default ────────────────────

  function loadTrackOrder() {
    try {
      var saved = localStorage.getItem('trackOrder');
      if (saved) {
        var parsed = JSON.parse(saved);
        // Validate: must contain all track ids from the default order
        var allIds = DEFAULT_TRACK_ORDER;
        if (Array.isArray(parsed) &&
            parsed.length === allIds.length &&
            parsed.every(function (id) { return allIds.indexOf(id) !== -1; })) {
          return parsed;
        }
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_TRACK_ORDER.slice();
  }

  function onReady() {
    App.state.trackOrder = loadTrackOrder();
    Canvas.init();
    Tooltip.init();
    Controls.init();
    DragSort.init();
    Canvas.render();
  }

  function showError(msg) {
    document.body.innerHTML =
      '<div style="color:#ef4444;padding:64px;font-family:Inter,-apple-system,sans-serif;background:#0d0d0d;height:100vh">' +
      '<h2 style="margin-bottom:12px;font-size:22px;font-weight:700;color:rgba(255,255,255,0.9);letter-spacing:-0.4px">Chronolines — 加载失败</h2>' +
      '<p style="color:rgba(255,255,255,0.55);font-size:14px">' + msg + '</p>' +
      '<p style="margin-top:16px;color:rgba(255,255,255,0.3);font-size:13px">' +
      '请通过 HTTP 服务器访问（如 <code style="background:#1a1a1a;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1)">python3 -m http.server</code>），' +
      '而不是直接打开 file:// 链接。</p>' +
      '</div>';
  }

  // ─── Start ──────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
