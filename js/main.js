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
      '<div style="color:#e74c3c;padding:48px;font-family:sans-serif;background:#1a1a2e;height:100vh">' +
      '<h2 style="margin-bottom:12px">Chronolines — 加载失败</h2>' +
      '<p style="color:#888">' + msg + '</p>' +
      '<p style="margin-top:16px;color:#666;font-size:13px">' +
      '请通过 HTTP 服务器访问（如 <code>python3 -m http.server</code>），' +
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
