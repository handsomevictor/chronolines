/**
 * tooltip.js — Hover tooltip and positioning logic.
 */

var Tooltip = (function () {
  'use strict';

  var tooltipEl;
  var OFFSET_X = 14;
  var OFFSET_Y = -10;

  function init() {
    tooltipEl = document.getElementById('tooltip');
  }

  function show(event, track, mouseEvent) {
    var yearStr = event.endYear
      ? event.year + '–' + event.endYear
      : event.year + ' 年';

    var tagsHtml = (event.tags || []).slice(0, 4).map(function (t) {
      return '<span class="tooltip-tag">' + t + '</span>';
    }).join('');

    tooltipEl.innerHTML =
      '<div class="tooltip-year">' + yearStr + ' · ' + track.name + '</div>' +
      '<div class="tooltip-title">' + event.title + '</div>' +
      '<div class="tooltip-summary">' + event.summary + '</div>' +
      (tagsHtml ? '<div class="tooltip-tags">' + tagsHtml + '</div>' : '');

    tooltipEl.classList.remove('hidden');
    position(mouseEvent);
  }

  function showCluster(group, track, mouseEvent) {
    var minYear = Math.min.apply(null, group.map(function (e) { return e.year; }));
    var maxYear = Math.max.apply(null, group.map(function (e) { return e.year; }));

    var listHtml = group.map(function (e) {
      return '<div style="margin:2px 0;color:#b0b0c8;font-size:11px;">· ' + e.title + '</div>';
    }).join('');

    tooltipEl.innerHTML =
      '<div class="tooltip-year">' + minYear + '–' + maxYear + ' · ' + track.name + '</div>' +
      '<div class="tooltip-title">' + group.length + ' 个事件</div>' +
      listHtml;

    tooltipEl.classList.remove('hidden');
    position(mouseEvent);
  }

  function move(mouseEvent) {
    position(mouseEvent);
  }

  function hide() {
    tooltipEl.classList.add('hidden');
  }

  function position(e) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var tw = tooltipEl.offsetWidth;
    var th = tooltipEl.offsetHeight;

    var x = e.clientX + OFFSET_X;
    var y = e.clientY + OFFSET_Y;

    // Prevent overflow
    if (x + tw > vw - 10) x = e.clientX - tw - OFFSET_X;
    if (y + th > vh - 10) y = e.clientY - th - Math.abs(OFFSET_Y);
    if (y < 10) y = 10;
    if (x < 10) x = 10;

    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  return {
    init: init,
    show: show,
    showCluster: showCluster,
    move: move,
    hide: hide,
  };
})();
