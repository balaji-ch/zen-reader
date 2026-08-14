// ZenReader - Bookmarks module (floating collapsible panel, green dot active, draggable)
'use strict';

// ===== DOM refs =====
const articleBody = document.getElementById('article-body');
const btnBookmarks = document.getElementById('btn-bookmarks');
const bookmarksPanel = document.getElementById('bookmarks-panel');
const bookmarksList = document.getElementById('bookmarks-list');
const bookmarksClose = document.querySelector('.bookmarks-close');
const bookmarksCollapsedBtn = document.getElementById('bookmarks-collapsed-btn');
const progressBar = document.getElementById('progress-bar');
const progressTrack = document.getElementById('progress-track');

// Inline SVG for the bookmark icon (small, 12x12)
const BOOKMARK_SVG = '<svg class="bookmark-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';

// ===== Scroll-to-top chevron in header =====
const btnScrollTop = document.getElementById('btn-scroll-top');
if (btnScrollTop) {
  btnScrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ===== Build bookmarks from headings =====
export function buildBookmarks() {
  const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
  bookmarksList.innerHTML = '';

  if (headings.length === 0) {
    bookmarksList.innerHTML = '<p style="padding: 12px 16px; color: #6c757d; font-size: 12px;">No headings found in this article.</p>';
    return;
  }

  headings.forEach((heading, index) => {
    if (!heading.id) {
      heading.id = 'zen-heading-' + index;
    }
    const level = parseInt(heading.tagName.charAt(1));
    const link = document.createElement('a');
    link.href = '#' + heading.id;
    link.innerHTML = BOOKMARK_SVG + '<span>' + heading.textContent.trim() + '</span>';
    link.setAttribute('data-level', level);
    link.setAttribute('data-heading-id', heading.id);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      bookmarksList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
      link.classList.add('active');
    });
    bookmarksList.appendChild(link);
  });

  updateActiveBookmark();
}

// ===== Toggle bookmarks panel =====
export function toggleBookmarks() {
  const isHidden = bookmarksPanel.classList.contains('hidden');
  if (isHidden) {
    bookmarksPanel.classList.remove('hidden');
    bookmarksCollapsedBtn.classList.add('hidden');
    btnBookmarks.classList.add('active');
    chrome.storage.sync.set({ bookmarksPanelOpen: true });
  } else {
    bookmarksPanel.classList.add('hidden');
    bookmarksCollapsedBtn.classList.remove('hidden');
    btnBookmarks.classList.remove('active');
    chrome.storage.sync.set({ bookmarksPanelOpen: false });
  }
}

btnBookmarks.addEventListener('click', toggleBookmarks);

bookmarksClose.addEventListener('click', () => {
  bookmarksPanel.classList.add('hidden');
  bookmarksCollapsedBtn.classList.remove('hidden');
  btnBookmarks.classList.remove('active');
  chrome.storage.sync.set({ bookmarksPanelOpen: false });
});

bookmarksCollapsedBtn.addEventListener('click', () => {
  bookmarksPanel.classList.remove('hidden');
  bookmarksCollapsedBtn.classList.add('hidden');
  btnBookmarks.classList.add('active');
  chrome.storage.sync.set({ bookmarksPanelOpen: true });
});



// Restore panel state from storage
chrome.storage.sync.get('bookmarksPanelOpen', (result) => {
  const isOpen = result.bookmarksPanelOpen !== false;
  if (isOpen) {
    bookmarksPanel.classList.remove('hidden');
    bookmarksCollapsedBtn.classList.add('hidden');
    btnBookmarks.classList.add('active');
  } else {
    bookmarksPanel.classList.add('hidden');
    bookmarksCollapsedBtn.classList.remove('hidden');
    btnBookmarks.classList.remove('active');
  }
});

// ===== Active bookmark: green dot for current section =====
function updateActiveBookmark() {
  const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let current = null;
  headings.forEach((heading) => {
    const rect = heading.getBoundingClientRect();
    if (rect.top <= 100) {
      current = heading;
    }
  });
  bookmarksList.querySelectorAll('a').forEach((a) => {
    const id = a.getAttribute('data-heading-id');
    a.classList.toggle('active', current ? id === current.id : false);
  });
}

// ===== Reading Progress Bar =====
function updateProgress() {
  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  const clamped = Math.min(progress, 100);
  const rounded = Math.round(clamped);
  progressBar.style.width = clamped + '%';
  progressTrack.setAttribute('data-progress', rounded);
  progressTrack.style.setProperty('--progress-tooltip-left', clamped + '%');
}

let scrollTimeout;
window.addEventListener('scroll', () => {
  updateProgress();
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(updateActiveBookmark, 100);
});

// ===== Reading Stats (rendered into article header) =====
export function showReadingStats() {
  const text = articleBody.textContent || '';
  const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const readingTime = Math.max(1, Math.ceil(words / 230));

  const statsEl = document.getElementById('article-stats');
  if (statsEl) {
    statsEl.innerHTML = `<span>${readingTime} min read</span><span>\u00B7</span><span>${words.toLocaleString()} words</span>`;
  }
}

// ===== Selection Word Count =====
const selectionCountEl = document.createElement('div');
selectionCountEl.className = 'selection-count';
document.body.appendChild(selectionCountEl);

document.addEventListener('selectionchange', () => {
  const sel = window.getSelection();
  const text = sel.toString().trim();
  if (text.length > 0) {
    const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount > 1) {
      selectionCountEl.textContent = wordCount + ' words selected';
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      selectionCountEl.style.top = (rect.top - 30) + 'px';
      selectionCountEl.style.left = (rect.left + rect.width / 2) + 'px';
      selectionCountEl.style.transform = 'translateX(-50%)';
      selectionCountEl.classList.add('visible');
    } else {
      selectionCountEl.classList.remove('visible');
    }
  } else {
    selectionCountEl.classList.remove('visible');
  }
});

// ===== Draggable bookmarks panel =====
const bookmarksDrag = document.getElementById('bookmarks-drag');
const EDGE = 8;
let bmPos = null;

chrome.storage.sync.get('bookmarksPanelPos', (result) => {
  if (result && result.bookmarksPanelPos &&
      typeof result.bookmarksPanelPos.top === 'number' &&
      typeof result.bookmarksPanelPos.left === 'number') {
    bmPos = result.bookmarksPanelPos;
    applyBmPosition();
  }
});

function applyBmPosition() {
  if (!bmPos) return;
  bookmarksPanel.style.top = bmPos.top + 'px';
  bookmarksPanel.style.left = bmPos.left + 'px';
  bookmarksPanel.style.bottom = 'auto';
  bookmarksCollapsedBtn.style.top = bmPos.top + 'px';
  bookmarksCollapsedBtn.style.left = bmPos.left + 'px';
}

if (bookmarksDrag) {
  let dragging = false;
  let startX = 0, startY = 0, originTop = 0, originLeft = 0;

  bookmarksDrag.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();

    const rect = bookmarksPanel.getBoundingClientRect();
    originTop = rect.top;
    originLeft = rect.left;
    startX = e.clientX;
    startY = e.clientY;
    dragging = true;

    bookmarksPanel.classList.add('dragging');
    try { bookmarksDrag.setPointerCapture(e.pointerId); } catch (_) {}
  });

  bookmarksDrag.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const w = bookmarksPanel.offsetWidth;
    const h = bookmarksPanel.offsetHeight;
    let top = originTop + (e.clientY - startY);
    let left = originLeft + (e.clientX - startX);
    left = Math.max(EDGE, Math.min(left, window.innerWidth - w - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - h - EDGE));
    bmPos = { top, left };
    applyBmPosition();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    bookmarksPanel.classList.remove('dragging');
    try { bookmarksDrag.releasePointerCapture(e.pointerId); } catch (_) {}
    if (bmPos) chrome.storage.sync.set({ bookmarksPanelPos: bmPos });
  }
  bookmarksDrag.addEventListener('pointerup', endDrag);
  bookmarksDrag.addEventListener('pointercancel', endDrag);
}

// Keep panel on screen on resize
window.addEventListener('resize', () => {
  if (bmPos) {
    const w = bookmarksPanel.offsetWidth;
    const h = bookmarksPanel.offsetHeight;
    bmPos.left = Math.max(EDGE, Math.min(bmPos.left, window.innerWidth - w - EDGE));
    bmPos.top = Math.max(EDGE, Math.min(bmPos.top, window.innerHeight - h - EDGE));
    applyBmPosition();
  }
});
