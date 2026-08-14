// ZenReader - Toolbar module (collapse, drag, minimize, keyboard shortcuts)
'use strict';



// ===== DOM refs =====
const rightToolbar = document.getElementById('right-toolbar');
const gearBtn = document.getElementById('gear-btn');
const btnAppearance = document.getElementById('btn-appearance');
const btnBookmarks = document.getElementById('btn-bookmarks');
const btnTips = document.getElementById('btn-tips');
const btnPrint = document.getElementById('btn-print');
const btnPdf = document.getElementById('btn-pdf');
const btnMarkdown = document.getElementById('btn-markdown');
const btnDarkMode = document.getElementById('btn-darkmode');
const appearancePopover = document.getElementById('appearance-popover');
const bookmarksPanel = document.getElementById('bookmarks-panel');

// ===== Collapse / expand =====
const TOOLBAR_COLLAPSE_DELAY = 10000;
let collapseTimer = null;

export function isPopoverOpen() {
  return !appearancePopover.classList.contains('hidden');
}

export function startCollapseTimer() {
  clearTimeout(collapseTimer);
  if (isPopoverOpen()) return;
  collapseTimer = setTimeout(collapseToolbar, TOOLBAR_COLLAPSE_DELAY);
}

function collapseToolbar() {
  if (isPopoverOpen()) return;
  rightToolbar.classList.add('collapsed');
  gearBtn.classList.remove('hidden');
}

export function expandToolbar() {
  rightToolbar.classList.remove('collapsed');
  gearBtn.classList.add('hidden');
  startCollapseTimer();
}

// Expand on gear click
gearBtn.addEventListener('click', () => {
  expandToolbar();
});

// Minimize button
const btnMinimize = document.getElementById('rtb-minimize');
if (btnMinimize) {
  btnMinimize.addEventListener('click', () => {
    clearTimeout(collapseTimer);
    if (!appearancePopover.classList.contains('hidden')) {
      appearancePopover.classList.add('hidden');
      btnAppearance.classList.remove('active');
    }
    collapseToolbar();
    gearBtn.classList.remove('bounce-in');
    void gearBtn.offsetWidth;
    gearBtn.classList.add('bounce-in');
    gearBtn.addEventListener('animationend', function onEnd() {
      gearBtn.classList.remove('bounce-in');
      gearBtn.removeEventListener('animationend', onEnd);
    });
  });
}

// Reset timer on toolbar interaction
rightToolbar.addEventListener('mouseenter', () => {
  clearTimeout(collapseTimer);
});

rightToolbar.addEventListener('mouseleave', () => {
  startCollapseTimer();
});

// Start the initial collapse timer
startCollapseTimer();

// ===== Draggable toolbar =====
const dragHandle = document.getElementById('rtb-handle');
const EDGE_MARGIN = 8;
let toolbarPos = null;

function clampPosition(top, left, el) {
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const maxLeft = window.innerWidth - w - EDGE_MARGIN;
  const maxTop = window.innerHeight - h - EDGE_MARGIN;
  return {
    top: Math.max(EDGE_MARGIN, Math.min(top, maxTop)),
    left: Math.max(EDGE_MARGIN, Math.min(left, maxLeft))
  };
}

function applyToolbarPosition() {
  if (!toolbarPos) return;
  [rightToolbar, gearBtn].forEach((el) => {
    el.style.right = 'auto';
    el.style.top = toolbarPos.top + 'px';
    el.style.left = toolbarPos.left + 'px';
  });
}

// Restore saved position on load
chrome.storage.sync.get('toolbarPos', (result) => {
  if (result && result.toolbarPos &&
      typeof result.toolbarPos.top === 'number' &&
      typeof result.toolbarPos.left === 'number') {
    toolbarPos = clampPosition(result.toolbarPos.top, result.toolbarPos.left, rightToolbar);
    applyToolbarPosition();
  }
});

if (dragHandle) {
  let dragging = false;
  let startX = 0, startY = 0;
  let originTop = 0, originLeft = 0;

  dragHandle.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();

    const rect = rightToolbar.getBoundingClientRect();
    originTop = rect.top;
    originLeft = rect.left;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;

    rightToolbar.classList.add('dragging');
    clearTimeout(collapseTimer);
    try { dragHandle.setPointerCapture(e.pointerId); } catch (_) {}
  });

  dragHandle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const next = clampPosition(originTop + dy, originLeft + dx, rightToolbar);
    toolbarPos = next;
    applyToolbarPosition();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    rightToolbar.classList.remove('dragging');
    try { dragHandle.releasePointerCapture(e.pointerId); } catch (_) {}
    startCollapseTimer();
    if (toolbarPos) chrome.storage.sync.set({ toolbarPos: toolbarPos });
  }
  dragHandle.addEventListener('pointerup', endDrag);
  dragHandle.addEventListener('pointercancel', endDrag);
}

// Keep toolbar on screen on resize (hints card repositioning handled in tips.js)
window.addEventListener('resize', () => {
  if (toolbarPos) {
    toolbarPos = clampPosition(toolbarPos.top, toolbarPos.left, rightToolbar);
    applyToolbarPosition();
  }
});

// ===== Keyboard Shortcuts (Alt+key) =====
// These are wired here; the actual toggle functions are imported by main.js
// and registered via setShortcutHandlers.
let shortcutHandlers = {};

export function setShortcutHandlers(handlers) {
  shortcutHandlers = handlers;
}

document.addEventListener('keydown', (e) => {
  // Esc works always
  if (e.key === 'Escape') {
    if (!appearancePopover.classList.contains('hidden')) {
      appearancePopover.classList.add('hidden');
      btnAppearance.classList.remove('active');
      startCollapseTimer();
    } else if (!bookmarksPanel.classList.contains('hidden')) {
      bookmarksPanel.classList.add('hidden');
      btnBookmarks.classList.remove('active');
      chrome.storage.sync.set({ bookmarksPanelOpen: false });
    }
    return;
  }

  // Alt+key shortcuts
  if (!e.altKey || e.ctrlKey || e.metaKey) return;

  switch (e.key.toLowerCase()) {
    case 'b':
      e.preventDefault();
      if (shortcutHandlers.toggleBookmarks) shortcutHandlers.toggleBookmarks();
      break;
    case 'd':
      e.preventDefault();
      if (shortcutHandlers.toggleDarkMode) shortcutHandlers.toggleDarkMode();
      break;
    case 'f':
      e.preventDefault();
      btnAppearance.click();
      break;
    case 'e':
      e.preventDefault();
      if (shortcutHandlers.toggleEditMode) shortcutHandlers.toggleEditMode();
      break;
    case 'o':
      e.preventDefault();
      if (shortcutHandlers.toggleFocusMode) shortcutHandlers.toggleFocusMode();
      break;
    case 't':
      e.preventDefault();
      btnTips.click();
      break;
    case 'p':
      e.preventDefault();
      btnPrint.click();
      break;
    case 's':
      e.preventDefault();
      btnPdf.click();
      break;
    case 'm':
      e.preventDefault();
      btnMarkdown.click();
      break;
    case '?':
    case '/':
      e.preventDefault();
      toggleShortcutCheatsheet();
      break;
  }
});

// ===== Shortcut Cheatsheet Overlay (Alt+?) =====
const SHORTCUTS = [
  ['Alt +', ''],
  ['B', 'Bookmarks'],
  ['D', 'Dark mode'],
  ['F', 'Fonts / appearance'],
  ['E', 'Edit mode'],
  ['O', 'Focus mode'],
  ['T', 'Edit tips'],
  ['P', 'Print'],
  ['S', 'Save as PDF'],
  ['M', 'Export Markdown'],
  ['?', 'This cheatsheet'],
  ['', ''],
  ['Esc', 'Close panel / popover'],
  ['Ctrl+Z', 'Undo edit action'],
];

function toggleShortcutCheatsheet() {
  const existing = document.getElementById('shortcut-cheatsheet');
  if (existing) {
    existing.classList.add('cheatsheet-dismiss');
    existing.addEventListener('animationend', () => existing.remove(), { once: true });
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'shortcut-cheatsheet';
  overlay.className = 'shortcut-cheatsheet';

  const card = document.createElement('div');
  card.className = 'cheatsheet-card';

  const header = document.createElement('div');
  header.className = 'cheatsheet-header';
  header.innerHTML = '<span>Keyboard Shortcuts</span>';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'cheatsheet-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => toggleShortcutCheatsheet());
  header.appendChild(closeBtn);
  card.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'cheatsheet-grid';

  SHORTCUTS.forEach(([key, desc]) => {
    // Empty row = visual separator
    if (!key && !desc) {
      const sep = document.createElement('div');
      sep.className = 'cheatsheet-sep';
      grid.appendChild(sep);
      return;
    }
    // Header row (e.g. "Alt +")
    if (!desc) {
      const hdr = document.createElement('div');
      hdr.className = 'cheatsheet-row cheatsheet-section';
      hdr.innerHTML = `<kbd>${key}</kbd>`;
      grid.appendChild(hdr);
      return;
    }
    const row = document.createElement('div');
    row.className = 'cheatsheet-row';
    row.innerHTML = `<kbd>${key}</kbd><span>${desc}</span>`;
    grid.appendChild(row);
  });

  card.appendChild(grid);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('visible'));

  // Close on overlay background click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) toggleShortcutCheatsheet();
  });

  // Close on Esc
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      toggleShortcutCheatsheet();
      document.removeEventListener('keydown', escHandler, true);
    }
  };
  document.addEventListener('keydown', escHandler, true);
}

// Export references needed by other modules
export { rightToolbar, gearBtn, appearancePopover, btnAppearance };
export { clampPosition };
