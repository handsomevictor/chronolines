/**
 * main.js — Entry point for Chronolines v2.
 * Loads data.json and bootstraps all modules.
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
    },

    YEAR_START: 1700,
    YEAR_END:   2025,
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
    // Boot order matters: Layout has no deps, Tooltip needs App.data,
    // Canvas needs Layout + Tooltip, Controls needs Canvas + Layout.
    Canvas.init();
    Tooltip.init();
    Controls.init();
    Canvas.render();
  }

  function showError(msg) {
    document.body.innerHTML =
      '<div style="color:#c0392b;padding:64px;font-family:Inter,-apple-system,sans-serif;background:#ffffff;height:100vh">' +
      '<h2 style="margin-bottom:12px;font-size:22px;font-weight:700;color:rgba(0,0,0,0.9);letter-spacing:-0.4px">Chronolines — 加载失败</h2>' +
      '<p style="color:#615d59;font-size:14px">' + msg + '</p>' +
      '<p style="margin-top:16px;color:#a39e98;font-size:13px">' +
      '请通过 HTTP 服务器访问（如 <code style="background:#f6f5f4;padding:2px 6px;border-radius:4px;border:1px solid rgba(0,0,0,0.1)">python3 -m http.server</code>），' +
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
