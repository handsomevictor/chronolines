/**
 * tooltip.js — Hover tooltip, detail panel, arc drawing.
 * Fix 0: dark theme colors throughout.
 * Fix 5: updated CATEGORY_COLORS to match canvas.js vivid palette.
 */

var Tooltip = (function () {
  'use strict';

  var el;
  var OFFSET_X = 16;
  var OFFSET_Y = -12;

  // Fix 0: tag colors — vivid enough to read on dark backgrounds
  var TAG_COLORS = {
    '战争':    '#e05c4f',
    '条约外交': '#4f8ef7',
    '革命政变': '#a78bfa',
    '改革运动': '#4ade80',
    '经济贸易': '#fb923c',
    '科技发明': '#06b6d4',
    '文化思想': '#f59e0b',
    '王朝更迭': '#94a3b8',
    '殖民扩张': '#f472b6',
    '人物':    '#e05c4f',
  };

  // Fix 5: vivid category colors matching canvas.js CATEGORY_COLORS
  var CATEGORY_COLORS = {
    '政治':    '#ef4444',
    '军事':    '#f97316',
    '科学':    '#3b82f6',
    '文学':    '#a855f7',
    '音乐':    '#ec4899',
    '艺术':    '#f59e0b',
    '经济金融': '#10b981',
    '哲学思想': '#06b6d4',
  };

  function init() {
    el = document.getElementById('tooltip');
  }

  // ─── Show / Hide ─────────────────────────────────────────────────────────

  function show(event, track, mouseEvt) {
    var color = Canvas.TRACK_COLORS[track.id] || track.color || '#888';

    var yearStr = event.endYear
      ? event.year + '–' + event.endYear
      : event.year + ' 年';

    var tagsHtml = (event.tags || []).map(function (t) {
      var c = TAG_COLORS[t] || '#888';
      return '<span class="tt-tag" style="background:' + c + '18;color:' + c +
             ';border:1px solid ' + c + '44">' + t + '</span>';
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
          '<span class="tt-track-dot" style="background:' + color + '"></span>' +
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
    var color = Canvas.TRACK_COLORS[track.id] || track.color || '#888';

    var minYear = group.reduce(function (m, e) { return Math.min(m, e.year); }, Infinity);
    var maxYear = group.reduce(function (m, e) { return Math.max(m, e.year); }, -Infinity);

    var itemsHtml = group.slice(0, 8).map(function (e) {
      return '<div class="tt-cluster-item">' + e.year + ' · ' + escHtml(e.title) + '</div>';
    }).join('');
    if (group.length > 8) {
      itemsHtml += '<div class="tt-cluster-item" style="color:rgba(255,255,255,0.25)">…还有 ' +
                   (group.length - 8) + ' 个</div>';
    }

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-meta">' +
          '<span class="tt-year">' + minYear + '–' + maxYear + '</span>' +
          '<span class="tt-track-dot" style="background:' + color + '"></span>' +
          '<span class="tt-track-name">' + track.name + '</span>' +
        '</div>' +
        '<div class="tt-title">' + group.length + ' 个事件</div>' +
      '</div>' +
      '<div class="tt-body">' + itemsHtml + '</div>';

    el.style.display = 'block';
    position(mouseEvt);
  }

  function showRuler(ruler, track, mouseEvt) {
    var color = Canvas.TRACK_COLORS[track.id] || track.color || '#888';
    var dur   = ruler.endYear - ruler.startYear;
    var durStr = dur > 0 ? '（' + dur + ' 年）' : '';

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-meta">' +
          '<span class="tt-track-dot" style="background:' + color + '"></span>' +
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
    var lifeStr  = (figure.birthYear || '?') + ' — ' + (figure.deathYear || '?');

    el.innerHTML =
      '<div class="tt-header">' +
        '<div class="tt-figure-name">' + escHtml(figure.name) +
          '<span class="tt-figure-cat" style="background:' + catColor + '18;color:' + catColor +
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

  function showDetail(event, track) {
    var panel = document.getElementById('detail-panel');
    var body  = document.getElementById('detail-body');
    var badge = document.getElementById('detail-track-badge');
    var color = Canvas.TRACK_COLORS[track.id] || track.color || '#888';

    badge.textContent = track.name;
    badge.style.background = color + '18';
    badge.style.color       = color;
    badge.style.border      = '1px solid ' + color + '55';

    var yearStr = event.endYear
      ? event.year + ' — ' + event.endYear
      : event.year + ' 年';

    var tagsHtml = (event.tags || []).map(function (t) {
      var c = TAG_COLORS[t] || '#888';
      return '<span class="detail-tag" style="background:' + c + '18;color:' + c +
             ';border:1px solid ' + c + '44">' + t + '</span>';
    }).join('');

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
          Canvas.panToYear(res.event.year);
        }
      });
    });

    panel.classList.remove('hidden');
    App.state.selectedEvent = event;

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
    var tracks = App.getOrderedTracks();
    for (var i = 0; i < tracks.length; i++) {
      var t    = tracks[i];
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
    init:         init,
    show:         show,
    showCluster:  showCluster,
    showRuler:    showRuler,
    showFigure:   showFigure,
    move:         move,
    hide:         hide,
    showDetail:   showDetail,
    hideDetail:   hideDetail,
    findFigure:   findFigure,
    findEvent:    findEvent,
    CATEGORY_COLORS: CATEGORY_COLORS,
  };
})();
