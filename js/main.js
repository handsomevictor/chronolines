/**
 * main.js — Entry point for Chronolines v3.
 * Loads data.json and bootstraps all modules.
 * Adds userMaxLevel state for Level selector (Fix 1).
 */

(function () {
  'use strict';

  // ─── Global app state ───────────────────────────────────────────────────────
  window.App = {
    data: null,

    state: {
      zoom:           0,      // pixels per year (0 = not yet set)
      panX:           0,      // horizontal pixel offset
      activeTag:      'all',  // tag filter
      activeCategory: 'none', // figure category filter
      searchQuery:    '',     // search string
      selectedEvent:  null,   // currently selected event object
      userMaxLevel:   3,      // Fix 1: user-selected max level (1/2/3)
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

  function onReady() {
    Canvas.init();
    Tooltip.init();
    Controls.init();
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
