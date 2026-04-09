/**
 * drag-sort.js — Pointer Events-based drag-to-reorder for sidebar track labels.
 *
 * Works with the sidebar's .sidebar-label elements (one per track).
 * Uses CSS transform to animate displaced rows, and creates a ghost overlay
 * that follows the pointer during drag.
 *
 * After drop: updates App.state.trackOrder, persists to localStorage,
 * then calls Canvas.rebuildAfterReorder() to re-render.
 */

var DragSort = (function () {
  'use strict';

  // Number of tracks (set on init)
  var NUM_TRACKS = 7;

  var DRAG = {
    active:      false,
    dragLabel:   null,   // the .sidebar-label element being dragged
    dragIndex:   -1,     // index when drag started
    targetIndex: -1,     // current drop target index
    startY:      0,      // clientY when drag started
    rowHeight:   0,      // height of each track row in px (= TRACK_HEIGHT)
    ghost:       null,   // floating ghost element
    sidebarRect: null,   // bounding rect of sidebar at drag start
  };

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    attachHandles();
  }

  /**
   * Attach pointerdown to all existing drag handles.
   * Called once on init; re-called by Canvas.rebuildAfterReorder via
   * rebuildHandles() which DragSort exports.
   */
  function attachHandles() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    // Remove any existing listeners by cloning all handles
    // We use event delegation on the sidebar instead to avoid stale listeners
    sidebar.removeEventListener('pointerdown', onSidebarPointerDown);
    sidebar.addEventListener('pointerdown', onSidebarPointerDown);
  }

  // ─── Event delegation: only react to drag-handle pointerdowns ─────────────

  function onSidebarPointerDown(e) {
    var handle = e.target;
    if (!handle || !handle.classList.contains('drag-handle')) return;
    var label = handle.closest ? handle.closest('.sidebar-label') : getParentLabel(handle);
    if (!label) return;
    onDragStart(e, label);
  }

  // IE/Edge fallback for .closest()
  function getParentLabel(el) {
    var cur = el.parentNode;
    while (cur) {
      if (cur.classList && cur.classList.contains('sidebar-label')) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  // ─── Drag start ────────────────────────────────────────────────────────────

  function onDragStart(e, label) {
    e.preventDefault();

    var sidebar = document.getElementById('sidebar');
    var labels  = getAllLabels();
    var idx     = labels.indexOf(label);
    if (idx < 0) return;

    NUM_TRACKS  = labels.length;
    var trackH  = Canvas.TRACK_HEIGHT; // shared constant

    DRAG.active      = true;
    DRAG.dragLabel   = label;
    DRAG.dragIndex   = idx;
    DRAG.targetIndex = idx;
    DRAG.startY      = e.clientY;
    DRAG.rowHeight   = trackH;
    DRAG.sidebarRect = sidebar.getBoundingClientRect();

    // Create ghost: a floating copy of the sidebar label that follows the cursor
    var rect  = label.getBoundingClientRect();
    var ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.cssText = [
      'position:fixed',
      'left:' + rect.left + 'px',
      'top:' + rect.top + 'px',
      'width:' + rect.width + 'px',
      'height:' + rect.height + 'px',
      'opacity:0.90',
      'pointer-events:none',
      'z-index:2000',
      'border-radius:6px',
      'box-shadow:0 0 0 1px rgba(255,255,255,0.18),0 12px 40px rgba(0,0,0,0.7)',
      'background:var(--bg-elevated)',
      'display:flex',
      'align-items:center',
      'padding:0 14px 0 2px',
      'gap:6px',
      'transition:none',
    ].join(';');

    // Copy label content into ghost
    ghost.innerHTML = label.innerHTML;
    document.body.appendChild(ghost);
    DRAG.ghost = ghost;

    // Dim the original label
    label.style.opacity    = '0.25';
    label.style.transition = 'none';

    // Capture pointer
    document.addEventListener('pointermove', onDragMove, { passive: false });
    document.addEventListener('pointerup',   onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  }

  // ─── Drag move ─────────────────────────────────────────────────────────────

  function onDragMove(e) {
    if (!DRAG.active) return;
    e.preventDefault();

    var deltaY    = e.clientY - DRAG.startY;
    var newIndex  = Math.round(DRAG.dragIndex + deltaY / DRAG.rowHeight);
    var clamped   = Math.max(0, Math.min(NUM_TRACKS - 1, newIndex));

    // Move ghost
    DRAG.ghost.style.transform = 'translateY(' + deltaY + 'px)';

    if (clamped !== DRAG.targetIndex) {
      DRAG.targetIndex = clamped;
      animateDisplacedLabels();
    }
  }

  // ─── Animate displaced labels ──────────────────────────────────────────────

  function animateDisplacedLabels() {
    var labels = getAllLabels();
    var h      = DRAG.rowHeight;

    labels.forEach(function (row, i) {
      if (row === DRAG.dragLabel) return;

      var offset = 0;
      if (DRAG.dragIndex < DRAG.targetIndex) {
        // Dragging downward: rows between dragIndex+1 and targetIndex slide up
        if (i > DRAG.dragIndex && i <= DRAG.targetIndex) offset = -h;
      } else {
        // Dragging upward: rows between targetIndex and dragIndex-1 slide down
        if (i >= DRAG.targetIndex && i < DRAG.dragIndex) offset = h;
      }

      row.style.transition = 'transform 200ms cubic-bezier(0.25,0.46,0.45,0.94)';
      row.style.transform  = offset ? 'translateY(' + offset + 'px)' : '';
    });
  }

  // ─── Drag end ──────────────────────────────────────────────────────────────

  function onDragEnd(e) {
    if (!DRAG.active) return;
    DRAG.active = false;

    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup',   onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);

    // Remove ghost
    if (DRAG.ghost) {
      DRAG.ghost.remove();
      DRAG.ghost = null;
    }

    // Clear all inline animation transforms
    var labels = getAllLabels();
    labels.forEach(function (row) {
      row.style.transition = '';
      row.style.transform  = '';
      row.style.opacity    = '';
    });

    var from = DRAG.dragIndex;
    var to   = DRAG.targetIndex;
    DRAG.dragLabel   = null;
    DRAG.dragIndex   = -1;
    DRAG.targetIndex = -1;

    if (from !== to) {
      reorderTracks(from, to);
    }
  }

  // ─── Reorder ───────────────────────────────────────────────────────────────

  function reorderTracks(fromIndex, toIndex) {
    var order = App.state.trackOrder.slice();
    var moved = order.splice(fromIndex, 1)[0];
    order.splice(toIndex, 0, moved);
    App.state.trackOrder = order;

    // Persist to localStorage
    try {
      localStorage.setItem('trackOrder', JSON.stringify(order));
    } catch (err) { /* ignore */ }

    // Rebuild sidebar and re-render SVG
    Canvas.rebuildAfterReorder();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function getAllLabels() {
    var sidebar = document.getElementById('sidebar');
    if (!sidebar) return [];
    var nodeList = sidebar.querySelectorAll('.sidebar-label');
    var arr = [];
    for (var i = 0; i < nodeList.length; i++) arr.push(nodeList[i]);
    // Sort by their current top (absolute position) so the order matches visual order
    arr.sort(function (a, b) {
      return parseFloat(a.style.top || 0) - parseFloat(b.style.top || 0);
    });
    return arr;
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  return {
    init:          init,
    attachHandles: attachHandles,
  };
})();
