/**
 * main.js — Entry point for Chronolines
 * Loads data.json, initializes all modules.
 */

(function () {
  'use strict';

  // Global app state
  window.App = {
    data: null,
    state: {
      zoom: 1,          // pixels per year
      panX: 0,          // horizontal offset in pixels
      activeTag: 'all', // current tag filter
      selectedEvent: null,
    },
    // Year range
    YEAR_START: 1700,
    YEAR_END: 2000,
  };

  function init() {
    // Load data from embedded JSON
    fetch('js/data.json')
      .then(function (res) {
        if (!res.ok) throw new Error('Failed to load data.json: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        App.data = data;
        console.log(
          'Chronolines loaded:',
          data._meta.total_events, 'events,',
          data._meta.total_figures, 'figures'
        );
        onDataReady();
      })
      .catch(function (err) {
        console.error('Data load error:', err);
        showError(err.message);
      });
  }

  function onDataReady() {
    Canvas.init();
    Controls.init();
    Tooltip.init();
    Canvas.render();
  }

  function showError(msg) {
    document.body.innerHTML =
      '<div style="color:#e74c3c;padding:40px;font-family:sans-serif;">' +
      '<h2>加载失败</h2><p>' + msg + '</p>' +
      '<p style="margin-top:12px;color:#888;">请确保通过 HTTP 服务器访问页面，而不是直接打开文件。</p>' +
      '</div>';
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
