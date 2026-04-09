/**
 * tooltip.js — Hover tooltip, detail panel, arc drawing.
 */

var Tooltip = (function () {
  'use strict';

  var el;
  var OFFSET_X = 16;
  var OFFSET_Y = -12;

  // Tag color map (mirrors CSS --chip-color values)
  var TAG_COLORS = {
    '战争':    '#c0392b',
    '条约外交': '#2980b9',
    '革命政变': '#8e44ad',
    '改革运动': '#27ae60',
    '经济贸易': '#f39c12',
    '科技发明': '#16a085',
    '文化思想': '#d35400',
    '王朝更迭': '#7f8c8d',
    '殖民扩张': '#2c3e50',
    '人物':    '#c0392b',
  };

  var CATEGORY_COLORS = {
    '政治':    '#e74c3c',
    '军事':    '#c0392b',
    '科学':    '#3498db',
    '文学':    '#9b59b6',
    '音乐':    '#e91e63',
    '艺术':    '#f39c12',
    '经济金融': '#27ae60',
    '哲学思想': '#1abc9c',
  };

  function init() {
    el = document.getElementById('tooltip');
  }

  // ─── Show / Hide ─────────────────────────────────────────────────────────

  function show(event, track, mouseEvt) {
    var yearStr = event.endYear
      ? event.year + '–' + event.endYear
      : event.year + ' 年';

    var tagsHtml = (event.tags || []).map(function (t) {
      var color = TAG_COLORS[t] || '#888';
      return '<span class="tt-tag" style="background:' + color + '22;color:' + color +
             ';border:1px solid ' + color + '44">' + t + '</span>';
    }).join('');

    var figuresHtml = '';
    if (event.figures && event.figures.length) {
      var names = event.figures.map(function (fid) {
        return findFigureName(fid);
      }).filter(Boolean);
      if (names.length) {
        figuresHtml = '<div class="tt-figures"><span class="tt-figures-label">相关人物：</span>' +
                      names.join('、') + '</div>';
      }
    }

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-meta">' +
          '<span class="tt-year">' + yearStr + '</span>' +
          '<span class="tt-track-dot" style="background:' + track.color + '"></span>' +
          '<span class="tt-track-name">' + track.name + '</span>' +
        '</div>' +
        '<div class="tt-title">' + escHtml(event.title) + '</div>' +
      '</div>' +
      '<div class="tt-body">' +
        '<div class="tt-summary">' + escHtml(event.summary || '') + '</div>' +
        (tagsHtml ? '<div class="tt-tags">' + tagsHtml + '</div>' : '') +
        figuresHtml +
      '</div>';

    el.style.display = 'block';
    position(mouseEvt);
  }

  function showCluster(group, track, mouseEvt) {
    var minYear = group.reduce(function (m, e) { return Math.min(m, e.year); }, Infinity);
    var maxYear = group.reduce(function (m, e) { return Math.max(m, e.year); }, -Infinity);

    var itemsHtml = group.slice(0, 8).map(function (e) {
      return '<div class="tt-cluster-item">' + e.year + ' · ' + escHtml(e.title) + '</div>';
    }).join('');
    if (group.length > 8) {
      itemsHtml += '<div class="tt-cluster-item" style="color:#666688">…还有 ' +
                   (group.length - 8) + ' 个</div>';
    }

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-meta">' +
          '<span class="tt-year">' + minYear + '–' + maxYear + '</span>' +
          '<span class="tt-track-dot" style="background:' + track.color + '"></span>' +
          '<span class="tt-track-name">' + track.name + '</span>' +
        '</div>' +
        '<div class="tt-title">' + group.length + ' 个事件</div>' +
      '</div>' +
      '<div class="tt-body">' + itemsHtml + '</div>';

    el.style.display = 'block';
    position(mouseEvt);
  }

  function showRuler(ruler, track, mouseEvt) {
    var dur = ruler.endYear - ruler.startYear;
    var durStr = dur > 0 ? '（' + dur + ' 年）' : '';

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-meta">' +
          '<span class="tt-track-dot" style="background:' + track.color + '"></span>' +
          '<span class="tt-track-name">' + track.name + '</span>' +
        '</div>' +
        '<div class="tt-ruler-name">' + escHtml(ruler.name) + '</div>' +
        '<div class="tt-ruler-title">' + escHtml(ruler.title) + '</div>' +
        '<div class="tt-ruler-years">' + ruler.startYear + ' — ' + ruler.endYear + durStr + '</div>' +
      '</div>';

    el.style.display = 'block';
    position(mouseEvt);
  }

  function showFigure(figure, track, mouseEvt) {
    var catColor = CATEGORY_COLORS[figure.category] || '#888';
    var lifeStr = (figure.birthYear || '?') + ' — ' + (figure.deathYear || '?');

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-figure-name">' + escHtml(figure.name) +
          '<span class="tt-figure-cat" style="background:' + catColor + '22;color:' + catColor +
          ';border:1px solid ' + catColor + '44">' + (figure.category || '') + '</span>' +
        '</div>' +
        '<div class="tt-figure-years">' + lifeStr + '</div>' +
        '<div class="tt-figure-summary">' + escHtml(figure.summary || '') + '</div>' +
      '</div>';

    el.style.display = 'block';
    position(mouseEvt);
  }

  function move(mouseEvt) {
    position(mouseEvt);
  }

  function hide() {
    el.style.display = 'none';
  }

  function position(e) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var tw = el.offsetWidth  || 280;
    var th = el.offsetHeight || 120;

    var x = e.clientX + OFFSET_X;
    var y = e.clientY + OFFSET_Y;

    if (x + tw > vw - 12) x = e.clientX - tw - OFFSET_X;
    if (y + th > vh - 12) y = e.clientY - th - Math.abs(OFFSET_Y);
    if (y < 10) y = 10;
    if (x < 10) x = 10;

    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }

  // ─── Detail Panel ─────────────────────────────────────────────────────────

  var TAG_COLORS_DETAIL = TAG_COLORS;

  function showDetail(event, track) {
    var panel  = document.getElementById('detail-panel');
    var body   = document.getElementById('detail-body');
    var badge  = document.getElementById('detail-track-badge');

    // Track badge
    badge.textContent = track.name;
    badge.style.background = track.color + '22';
    badge.style.color       = track.color;
    badge.style.border      = '1px solid ' + track.color + '55';

    var yearStr = event.endYear
      ? event.year + ' — ' + event.endYear
      : event.year + ' 年';

    // Tags
    var tagsHtml = (event.tags || []).map(function (t) {
      var c = TAG_COLORS_DETAIL[t] || '#888';
      return '<span class="detail-tag" style="background:' + c + '22;color:' + c +
             ';border:1px solid ' + c + '44">' + t + '</span>';
    }).join('');

    // Figures
    var figuresHtml = '';
    if (event.figures && event.figures.length) {
      var chips = event.figures.map(function (fid) {
        var fig = findFigure(fid);
        if (!fig) return '';
        var catColor = CATEGORY_COLORS[fig.category] || '#888';
        return '<span class="detail-figure-chip" data-figure-id="' + fid + '"' +
               ' style="border-color:' + catColor + '44">' +
               fig.name + '</span>';
      }).filter(Boolean).join('');
      if (chips) {
        figuresHtml = '<div class="detail-section-title">相关人物</div>' +
                      '<div class="detail-figure-list">' + chips + '</div>';
      }
    }

    // Related events
    var relatedHtml = '';
    if (event.related && event.related.length) {
      var items = event.related.map(function (rid) {
        var found = findEvent(rid);
        if (!found) return '';
        return '<span class="detail-related-item" data-event-id="' + rid + '">' +
               escHtml(found.event.title) + ' (' + found.event.year + ')</span>';
      }).filter(Boolean).join('');
      if (items) {
        relatedHtml = '<div class="detail-section-title">关联事件</div>' +
                      '<div class="detail-related-list">' + items + '</div>';
      }
    }

    var detailBlock = event.detail
      ? '<div class="detail-detail">' + escHtml(event.detail) + '</div>'
      : '';

    body.innerHTML =
      '<div class="detail-year">' + yearStr + '</div>' +
      '<div class="detail-title">' + escHtml(event.title) + '</div>' +
      '<div class="detail-summary">' + escHtml(event.summary || '') + '</div>' +
      detailBlock +
      (tagsHtml ? '<div class="detail-tags">' + tagsHtml + '</div>' : '') +
      figuresHtml +
      relatedHtml;

    // Wire related-event clicks
    body.querySelectorAll('.detail-related-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var eid = el.getAttribute('data-event-id');
        var res = findEvent(eid);
        if (res) {
          showDetail(res.event, res.track);
          // Pan the timeline to focus that event
          Canvas.panToYear(res.event.year);
        }
      });
    });

    panel.classList.remove('hidden');
    App.state.selectedEvent = event;

    // Draw arc lines to related events
    Canvas.drawRelatedArcs(event);
  }

  function hideDetail() {
    var panel = document.getElementById('detail-panel');
    panel.classList.add('hidden');
    App.state.selectedEvent = null;
    Canvas.clearArcs();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function findFigureName(fid) {
    if (!App.data || !App.data.figures) return fid;
    var all = App.data.figures;
    for (var k in all) {
      if (!all.hasOwnProperty(k)) continue;
      for (var i = 0; i < all[k].length; i++) {
        if (all[k][i].id === fid) return all[k][i].name;
      }
    }
    return fid;
  }

  function findFigure(fid) {
    if (!App.data || !App.data.figures) return null;
    var all = App.data.figures;
    for (var k in all) {
      if (!all.hasOwnProperty(k)) continue;
      for (var i = 0; i < all[k].length; i++) {
        if (all[k][i].id === fid) return all[k][i];
      }
    }
    return null;
  }

  function findEvent(eid) {
    if (!App.data) return null;
    var tracks = App.data.tracks;
    for (var i = 0; i < tracks.length; i++) {
      var t = tracks[i];
      var evts = App.data.events[t.id] || [];
      for (var j = 0; j < evts.length; j++) {
        if (evts[j].id === eid) return { event: evts[j], track: t };
      }
    }
    return null;
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    init:       init,
    show:       show,
    showCluster: showCluster,
    showRuler:  showRuler,
    showFigure: showFigure,
    move:       move,
    hide:       hide,
    showDetail: showDetail,
    hideDetail: hideDetail,
    findFigure: findFigure,
    findEvent:  findEvent,
    CATEGORY_COLORS: CATEGORY_COLORS,
  };
})();
