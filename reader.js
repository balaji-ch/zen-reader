// ZenReader - Main reader page logic
(function() {
  'use strict';

  // ===== State =====
  let articleData = null;

  // ===== Undo stack =====
  const undoStack = [];
  const MAX_UNDO = 50;

  function pushUndo(action) {
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO) undoStack.shift();
  }

  function performUndo() {
    if (undoStack.length === 0) {
      showToast('Nothing to undo');
      return;
    }
    const action = undoStack.pop();
    switch (action.type) {
      case 'delete': {
        action.items.forEach((item) => {
          if (item.nextSibling && item.parent.contains(item.nextSibling)) {
            item.parent.insertBefore(item.element, item.nextSibling);
          } else if (item.parent) {
            item.parent.appendChild(item.element);
          }
        });
        showToast('Undo: restored ' + action.items.length + ' element' + (action.items.length > 1 ? 's' : ''));
        break;
      }
      case 'edit': {
        action.element.innerHTML = action.oldHTML;
        showToast('Undo: text reverted');
        break;
      }
      case 'resize': {
        action.items.forEach((item) => {
          item.element.style.width = item.oldWidth;
          item.element.style.maxWidth = item.oldMaxWidth;
        });
        showToast('Undo: image resize reverted');
        break;
      }

    }
  }

  // Global Ctrl+Z handler
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      const active = document.activeElement;
      if (active && active.getAttribute('contenteditable') === 'true') return;
      e.preventDefault();
      performUndo();
    }
  });

  // ===== DOM refs =====
  const articleTitle = document.getElementById('article-title');
  const articleByline = document.getElementById('article-byline');
  const articleSource = document.getElementById('article-source');
  const articleBody = document.getElementById('article-body');
  const fontSelect = document.getElementById('font-select');
  const codeFontSelect = document.getElementById('code-font-select');
  const fontSizeRange = document.getElementById('font-size-range');
  const fontSizeLabel = document.getElementById('font-size-label');
  const codeSizeRange = document.getElementById('code-size-range');
  const codeSizeLabel = document.getElementById('code-size-label');
  const textWeightGroup = document.getElementById('text-weight-group');
  const codeWeightGroup = document.getElementById('code-weight-group');
  const googleFontsLink = document.getElementById('google-fonts-link');

  // New UI refs
  const rightToolbar = document.getElementById('right-toolbar');
  const gearBtn = document.getElementById('gear-btn');
  const btnBookmarks = document.getElementById('btn-bookmarks');
  const btnAppearance = document.getElementById('btn-appearance');
  const btnTips = document.getElementById('btn-tips');
  const btnPrint = document.getElementById('btn-print');
  const btnPdf = document.getElementById('btn-pdf');

  const btnDarkMode = document.getElementById('btn-darkmode');
  const bookmarksPanel = document.getElementById('bookmarks-panel');
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarksClose = document.querySelector('.bookmarks-close');
  const appearancePopover = document.getElementById('appearance-popover');

  // ===== Dark Mode =====
  function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark');
    btnDarkMode.classList.toggle('active', isDark);
    chrome.storage.sync.set({ darkMode: isDark });
  }

  btnDarkMode.addEventListener('click', toggleDarkMode);

  // Restore dark mode preference (falls back to system preference if not explicitly set)
  chrome.storage.sync.get('darkMode', (result) => {
    let shouldBeDark = false;
    if (result.darkMode !== undefined) {
      shouldBeDark = result.darkMode;
    } else {
      // Auto-detect from system preference
      shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    if (shouldBeDark) {
      document.body.classList.add('dark');
      btnDarkMode.classList.add('active');
    }
  });

  // ===== Banner: fade after 10s like old toolbar =====
  const banner = document.getElementById('banner');
  const BANNER_FADE_DELAY = 10000;

  setTimeout(() => {
    banner.classList.add('faded');
  }, BANNER_FADE_DELAY);

  // ===== Right Toolbar: Collapse to gear after 10s =====
  const TOOLBAR_COLLAPSE_DELAY = 10000;
  let collapseTimer = null;

  function isPopoverOpen() {
    return !appearancePopover.classList.contains('hidden');
  }

  function startCollapseTimer() {
    clearTimeout(collapseTimer);
    if (isPopoverOpen()) return; // Don't collapse while popover is open
    collapseTimer = setTimeout(collapseToolbar, TOOLBAR_COLLAPSE_DELAY);
  }

  function collapseToolbar() {
    if (isPopoverOpen()) return; // Safety check
    rightToolbar.classList.add('collapsed');
    gearBtn.classList.remove('hidden');
  }

  function expandToolbar() {
    rightToolbar.classList.remove('collapsed');
    gearBtn.classList.add('hidden');
    startCollapseTimer();
  }

  // Expand on gear click
  gearBtn.addEventListener('click', () => {
    expandToolbar();
  });

  // Explicit minimize: collapse immediately into the gear (with a bounce),
  // regardless of the auto-collapse timer. Closes the appearance popover first
  // so the collapse isn't blocked by the "don't collapse while popover open"
  // guard in collapseToolbar().
  const btnMinimize = document.getElementById('rtb-minimize');
  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      clearTimeout(collapseTimer);
      if (!appearancePopover.classList.contains('hidden')) {
        appearancePopover.classList.add('hidden');
        btnAppearance.classList.remove('active');
      }
      collapseToolbar();
      // Bounce the gear as it appears.
      gearBtn.classList.remove('bounce-in');
      // Force reflow so the animation restarts if minimized repeatedly.
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
  // The toolbar (and its collapsed gear button) can be dragged anywhere in the
  // viewport via the grip handle. Position is stored as {top, left} in px and
  // persisted to chrome.storage.sync so it survives reloads. When a custom
  // position is set we switch from right-anchored to left/top-anchored layout
  // (right:auto) and apply the SAME coordinates to both the toolbar and the
  // gear button so the gear appears exactly where the toolbar was left.
  const dragHandle = document.getElementById('rtb-handle');
  const EDGE_MARGIN = 8; // keep at least this many px from any viewport edge
  let toolbarPos = null; // { top, left } once the user has moved it

  // Clamp a desired top/left so the given element stays fully on screen.
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

  // Apply the current custom position to both toolbar and gear button.
  function applyToolbarPosition() {
    if (!toolbarPos) return;
    [rightToolbar, gearBtn].forEach((el) => {
      el.style.right = 'auto';
      el.style.top = toolbarPos.top + 'px';
      el.style.left = toolbarPos.left + 'px';
    });
  }

  // Restore a saved position (if any) on load.
  chrome.storage.sync.get('toolbarPos', (result) => {
    if (result && result.toolbarPos &&
        typeof result.toolbarPos.top === 'number' &&
        typeof result.toolbarPos.left === 'number') {
      // Clamp against the current viewport in case the window is now smaller.
      toolbarPos = clampPosition(result.toolbarPos.top, result.toolbarPos.left, rightToolbar);
      applyToolbarPosition();
    }
  });

  if (dragHandle) {
    let dragging = false;
    let startX = 0, startY = 0;      // pointer position at drag start
    let originTop = 0, originLeft = 0; // toolbar position at drag start

    dragHandle.addEventListener('pointerdown', (e) => {
      // Left button / primary pointer only.
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();

      const rect = rightToolbar.getBoundingClientRect();
      originTop = rect.top;
      originLeft = rect.left;
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;

      rightToolbar.classList.add('dragging');
      clearTimeout(collapseTimer); // don't auto-collapse mid-drag
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
      startCollapseTimer(); // resume auto-collapse behaviour
      if (toolbarPos) chrome.storage.sync.set({ toolbarPos: toolbarPos });
    }
    dragHandle.addEventListener('pointerup', endDrag);
    dragHandle.addEventListener('pointercancel', endDrag);
  }

  // Keep the toolbar (and any open tips card) on screen if the window resizes.
  window.addEventListener('resize', () => {
    if (toolbarPos) {
      toolbarPos = clampPosition(toolbarPos.top, toolbarPos.left, rightToolbar);
      applyToolbarPosition();
    }
    const openCard = document.querySelector('.reader-hints-card');
    if (openCard) positionHintsCard(openCard);
  });

  // ===== Keyboard Shortcuts (Alt+key) =====
  document.addEventListener('keydown', (e) => {
    // Esc works always (no modifier needed)
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
        toggleBookmarks();
        break;
      case 'd':
        e.preventDefault();
        toggleDarkMode();
        break;
      case 'f':
        e.preventDefault();
        btnAppearance.click();
        break;
      case 'e':
        e.preventDefault();
        toggleEditMode();
        break;
      case 'o':
        e.preventDefault();
        toggleFocusMode();
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
        // btnMarkdown is declared later in this function scope; the handler
        // only fires on user keypress (long after init) so the ref is set.
        btnMarkdown.click();
        break;
    }
  });

  // ===== Bookmarks Panel =====
  function buildBookmarks() {
    const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
    bookmarksList.innerHTML = '';

    if (headings.length === 0) {
      bookmarksList.innerHTML = '<p style="padding: 12px 16px; color: #6c757d; font-size: 12px;">No headings found in this article.</p>';
      return;
    }

    headings.forEach((heading, index) => {
      // Add an id for anchor linking if missing
      if (!heading.id) {
        heading.id = 'zen-heading-' + index;
      }
      const level = parseInt(heading.tagName.charAt(1));
      const link = document.createElement('a');
      link.href = '#' + heading.id;
      link.textContent = heading.textContent.trim();
      link.setAttribute('data-level', level);
      link.setAttribute('data-heading-id', heading.id); // for scroll-spy read state
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight active
        bookmarksList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      });
      bookmarksList.appendChild(link);
    });

    // Initialise read-progress state for the freshly-built list.
    updateActiveBookmark();
  }

  function toggleBookmarks() {
    const isHidden = bookmarksPanel.classList.contains('hidden');
    if (isHidden) {
      bookmarksPanel.classList.remove('hidden');
      btnBookmarks.classList.add('active');
      chrome.storage.sync.set({ bookmarksPanelOpen: true });
    } else {
      bookmarksPanel.classList.add('hidden');
      btnBookmarks.classList.remove('active');
      chrome.storage.sync.set({ bookmarksPanelOpen: false });
    }
  }

  btnBookmarks.addEventListener('click', toggleBookmarks);
  bookmarksClose.addEventListener('click', () => {
    bookmarksPanel.classList.add('hidden');
    btnBookmarks.classList.remove('active');
    chrome.storage.sync.set({ bookmarksPanelOpen: false });
  });

  // Back-to-top (bookmarks panel footer)
  const btnBackToTop = document.getElementById('btn-back-to-top');
  if (btnBackToTop) {
    btnBackToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Restore bookmarks panel state from storage
  chrome.storage.sync.get('bookmarksPanelOpen', (result) => {
    // Default is open (true) if never set
    const isOpen = result.bookmarksPanelOpen !== false;
    if (isOpen) {
      bookmarksPanel.classList.remove('hidden');
      btnBookmarks.classList.add('active');
    } else {
      bookmarksPanel.classList.add('hidden');
      btnBookmarks.classList.remove('active');
    }
  });

  // Update active bookmark + per-section read progress on scroll.
  // A section is "read" once its heading has scrolled above the top threshold;
  // the current section (last heading above the threshold) is "active".
  function updateActiveBookmark() {
    const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let current = null;
    const passed = new Set();
    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 100) {
        current = heading;
        passed.add(heading.id);
      }
    });
    bookmarksList.querySelectorAll('a').forEach((a) => {
      const id = a.getAttribute('data-heading-id');
      a.classList.toggle('read', passed.has(id));
      a.classList.toggle('active', current ? id === current.id : false);
    });
  }

  // ===== Reading Progress Bar =====
  const progressBar = document.getElementById('progress-bar');

  function updateProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progressBar.style.width = Math.min(progress, 100) + '%';
  }

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    updateProgress();
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(updateActiveBookmark, 100);
  });

  // ===== Appearance Popover =====
  btnAppearance.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = appearancePopover.classList.contains('hidden');
    if (isHidden) {
      appearancePopover.classList.remove('hidden');
      btnAppearance.classList.add('active');
      clearTimeout(collapseTimer); // Pause collapse while popover is open
    } else {
      appearancePopover.classList.add('hidden');
      btnAppearance.classList.remove('active');
      startCollapseTimer(); // Resume collapse timer
    }
  });

  // Close appearance popover on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.appearance-popover') && !e.target.closest('#btn-appearance')) {
      if (!appearancePopover.classList.contains('hidden')) {
        appearancePopover.classList.add('hidden');
        btnAppearance.classList.remove('active');
        startCollapseTimer(); // Resume collapse timer
      }
    }
  });

  appearancePopover.addEventListener('click', (e) => e.stopPropagation());

  // ===== Load article data =====
  chrome.storage.local.get('articleData', (result) => {
    if (!result.articleData) {
      articleBody.innerHTML = '<p>No article data found. Click the extension icon on an article page first.</p>';
      return;
    }
    articleData = result.articleData;
    renderArticle();
  });

  // ===== Load saved preferences =====
  chrome.storage.sync.get(['bodyFont', 'codeFont', 'fontSize', 'codeFontSize', 'textWeight', 'codeWeight'], (prefs) => {
    if (prefs.bodyFont) {
      fontSelect.value = prefs.bodyFont;
      applyBodyFont(prefs.bodyFont);
    }
    if (prefs.codeFont) {
      codeFontSelect.value = prefs.codeFont;
      applyCodeFont(prefs.codeFont);
    }
    if (prefs.fontSize) {
      fontSizeRange.value = prefs.fontSize;
      fontSizeLabel.textContent = prefs.fontSize + 'px';
      applyFontSize(prefs.fontSize);
    }
    if (prefs.codeFontSize) {
      codeSizeRange.value = prefs.codeFontSize;
      codeSizeLabel.textContent = prefs.codeFontSize + 'px';
      applyCodeFontSize(prefs.codeFontSize);
    }
    if (prefs.textWeight) {
      setWeightActive(textWeightGroup, prefs.textWeight);
      applyTextWeight(prefs.textWeight);
    }
    if (prefs.codeWeight) {
      setWeightActive(codeWeightGroup, prefs.codeWeight);
      applyCodeWeight(prefs.codeWeight);
    }
  });

  // ===== Render the article =====
  function renderArticle() {
    document.title = articleData.title + ' - ZenReader';
    articleTitle.textContent = articleData.title;

    if (articleData.byline) {
      articleByline.textContent = articleData.byline;
    } else {
      articleByline.style.display = 'none';
    }

    if (articleData.url) {
      const domain = new URL(articleData.url).hostname;
      articleSource.innerHTML = `<a href="${articleData.url}" target="_blank">${domain}</a>`;
    }

    // Set content
    articleBody.innerHTML = articleData.content;

    // Render LaTeX math if present (KaTeX)
    renderMath();

    // Load remote images that are blocked by referrer/hotlink protection
    loadRemoteImages();

    // Constrain small decorative/inline images
    constrainDecorativeImages();

    // Process code blocks
    processCodeBlocks();

    // Make elements deletable
    makeDeletable();

    // Make text editable on double-click
    makeEditable();

    // Make images resizable
    makeImagesResizable();

    // Build bookmarks from headings
    buildBookmarks();

    // Show reading stats
    showReadingStats();

    // Restore focus mode if it was on last time (needs rendered content first).
    chrome.storage.sync.get('focusMode', (result) => {
      if (result && result.focusMode) {
        setFocusMode(true, { persist: false, announce: false });
      }
    });

    // Show hints toast
    showHintsToast();
  }

  // ===== Reading Stats (time + word count) =====
  function showReadingStats() {
    const text = articleBody.textContent || '';
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const readingTime = Math.max(1, Math.ceil(words / 230)); // ~230 wpm average

    const statsEl = document.getElementById('bookmarks-stats');
    statsEl.innerHTML = `<span>\u{1F4D6} ${readingTime} min read</span><span>\u{1F4DD} ${words.toLocaleString()} words</span>`;
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
        // Position near the selection
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

  // ===== Render Math (KaTeX) =====
  function renderMath() {
    if (typeof renderMathInElement === 'undefined') return;

    // Check if there's any LaTeX-like content before doing the work.
    // Match: $...$ / $$...$$ inline+display, \( \), \[ \], or \begin{...}.
    const text = articleBody.textContent;
    const hasLatex =
      /\$[^$]+\$/.test(text) ||          // $...$ (also covers $$...$$)
      /\\\([\s\S]+?\\\)/.test(text) ||   // \( ... \)
      /\\\[[\s\S]+?\\\]/.test(text) ||   // \[ ... \]
      /\\begin\{/.test(text);            // \begin{equation} etc.
    if (!hasLatex) return;

    // Unwrap any <span class="zen-math-source"> wrappers left by content.js
    // so the LaTeX text is directly in the flow for KaTeX auto-render to find
    articleBody.querySelectorAll('span.zen-math-source').forEach((span) => {
      const textNode = document.createTextNode(span.textContent);
      span.parentNode.replaceChild(textNode, span);
    });

    try {
      renderMathInElement(articleBody, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false }
        ],
        throwOnError: false,
        trust: true,
        strict: false,
        macros: {
          '\\set': '\\{#1\\}',
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\C': '\\mathbb{C}',
          '\\norm': '\\|#1\\|',
          '\\abs': '|#1|',
          '\\argmax': '\\operatorname{arg\\,max}',
          '\\argmin': '\\operatorname{arg\\,min}'
        },
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'annotation', 'annotation-xml']
      });
    } catch (e) {
      console.warn('KaTeX rendering error:', e);
    }
  }

  // ===== Load remote images (referrer/hotlink workaround) =====
  // Some image CDNs return 404 for <img> requests that carry a cross-origin
  // (chrome-extension://) Referer, even though a no-referrer fetch succeeds.
  // For each remote image we fetch the bytes with referrer disabled and swap in
  // a blob: URL. This is fully generic (applies to any host) and only kicks in
  // if the direct <img> load fails, so normal images are unaffected.
  function loadRemoteImages() {
    const images = articleBody.querySelectorAll('img');
    images.forEach((img) => {
      const src = img.getAttribute('src') || '';
      // Only handle remote http(s) images; skip data:/blob:/relative.
      if (!/^https?:\/\//.test(src)) return;

      // Only fall back to the background fetch if the direct <img> load fails
      // (keeps normal images fast; only referrer-blocked CDNs pay the cost).
      img.addEventListener('error', () => fetchAsBlob(img, src), { once: true });

      // If it already finished loading with no pixels (fast 404), fall back now.
      if (img.complete && img.naturalWidth === 0) {
        fetchAsBlob(img, src);
      }
    });
  }

  function fetchAsBlob(img, src) {
    // Avoid double-processing / loops once we've swapped the src.
    if (img.dataset.blobLoaded === '1') return;
    // An in-page no-cors fetch returns an empty (opaque) blob, so instead ask
    // the background service worker (which has host_permissions) to fetch the
    // bytes with no referrer and hand back a data: URL we can display.
    chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url: src }, (resp) => {
      if (chrome.runtime.lastError) return; // messaging failed; leave original
      if (resp && resp.success && resp.dataUrl) {
        img.dataset.blobLoaded = '1';
        img.removeAttribute('srcset'); // ensure the data URL is used
        img.setAttribute('src', resp.dataUrl);
      }
    });
  }

  // ===== Constrain decorative/inline images =====
  function constrainDecorativeImages() {
    const images = articleBody.querySelectorAll('img');
    images.forEach((img) => {
      const check = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        if (natW > 0 && natH > 0 && natW <= 40 && natH <= 40) {
          img.style.display = 'inline';
          img.style.verticalAlign = 'middle';
          img.style.margin = '0 0.15em';
          img.style.borderRadius = '0';
          img.style.maxHeight = '1.2em';
          img.style.width = 'auto';
          img.style.maxWidth = 'none';
        } else if (natW > 0 && natH > 0 && natW <= 64 && natH <= 64) {
          img.style.display = 'inline-block';
          img.style.verticalAlign = 'middle';
          img.style.margin = '0 0.25em';
          img.style.borderRadius = '0';
          img.style.maxHeight = '1.5em';
          img.style.width = 'auto';
          img.style.maxWidth = 'none';
        }
      };

      if (img.complete && img.naturalWidth > 0) {
        check();
      } else {
        img.addEventListener('load', check);
      }
    });
  }

  // ===== Process code blocks =====
  function processCodeBlocks() {
    const preBlocks = articleBody.querySelectorAll('pre');

    preBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      // A "real" language comes from an explicit class/attribute on the page.
      // Anything hljs guesses is flagged auto so markdown export can ignore it.
      let lang = detectLanguage(code) || detectLanguage(pre);
      let langIsAuto = false;

      if (!lang && code.textContent.trim().length > 0) {
        const result = hljs.highlightAuto(code.textContent);
        if (result.language && result.relevance > 5) {
          lang = result.language;
          langIsAuto = true;
        }
      }

      if (lang) {
        pre.setAttribute('data-lang', lang);
        if (langIsAuto) pre.setAttribute('data-lang-auto', 'true');
        if (!code.querySelector('.hljs-keyword, .hljs-string, .hljs-comment')) {
          try {
            const highlighted = hljs.highlight(code.textContent, { language: lang });
            code.innerHTML = highlighted.value;
          } catch (e) {
            const result = hljs.highlightAuto(code.textContent);
            code.innerHTML = result.value;
            if (result.language) {
              lang = result.language;
              pre.setAttribute('data-lang', lang);
              pre.setAttribute('data-lang-auto', 'true');
            }
          }
        }
      } else {
        if (!code.querySelector('.hljs-keyword, .hljs-string, .hljs-comment')) {
          const result = hljs.highlightAuto(code.textContent);
          if (result.language && result.relevance > 3) {
            code.innerHTML = result.value;
            lang = result.language;
            pre.setAttribute('data-lang', lang);
            pre.setAttribute('data-lang-auto', 'true');
          }
        }
      }

      code.style.whiteSpace = 'pre-wrap';
      code.style.wordBreak = 'break-word';
    });
  }

  function detectLanguage(el) {
    if (!el) return null;
    const classes = el.className || '';
    const match = classes.match(/(?:language|lang|highlight)-(\w+)/);
    if (match) return normalizeLanguage(match[1]);
    if (el.dataset && el.dataset.lang) return normalizeLanguage(el.dataset.lang);
    if (el.dataset && el.dataset.language) return normalizeLanguage(el.dataset.language);
    return null;
  }

  function normalizeLanguage(lang) {
    const map = {
      'py': 'python', 'js': 'javascript', 'ts': 'typescript',
      'sh': 'bash', 'shell': 'bash', 'console': 'bash', 'zsh': 'bash',
      'yml': 'yaml', 'htm': 'html', 'cu': 'cuda', 'cuh': 'cuda',
      'cplusplus': 'cpp', 'c++': 'cpp', 'rs': 'rust', 'rb': 'ruby',
      'kt': 'kotlin', 'cs': 'csharp', 'objective-c': 'objectivec', 'objc': 'objectivec'
    };
    lang = lang.toLowerCase();
    return map[lang] || lang;
  }

  // ===== Focus Mode =====
  let focusModeActive = false;
  const btnFocus = document.getElementById('btn-focus');

  // Readability wraps content in #readability-page-1 > article, so the real
  // blocks are not direct children of #article-body. Find the deepest single
  // wrapper that actually holds the article's block elements.
  function getContentContainer() {
    let container = articleBody;
    // Descend through single-wrapper layers (e.g. #readability-page-1 > article)
    for (let i = 0; i < 4; i++) {
      const blockChildren = Array.from(container.children).filter(el =>
        /^(P|H1|H2|H3|H4|H5|H6|PRE|BLOCKQUOTE|UL|OL|TABLE|FIGURE|IMG)$/.test(el.tagName));
      if (blockChildren.length >= 2) return container; // found the real content layer
      // Otherwise descend into the single/most-significant wrapper child
      const wrappers = Array.from(container.children).filter(el =>
        el.children.length > 0);
      if (wrappers.length === 1) {
        container = wrappers[0];
      } else {
        break;
      }
    }
    return container;
  }

  function getFocusableBlocks() {
    const container = getContentContainer();
    const blocks = container.querySelectorAll(
      ':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6, :scope > pre, :scope > blockquote, :scope > ul, :scope > ol, :scope > table, :scope > figure, :scope > img, :scope > div');
    return Array.from(blocks);
  }

  // Apply/clear focus mode. `persist` (default true) writes the state to
  // storage; `announce` (default true) shows the toast. Restore-on-load passes
  // both false so it doesn't re-write storage or pop a toast.
  function setFocusMode(on, { persist = true, announce = true } = {}) {
    focusModeActive = on;
    btnFocus.classList.toggle('active', focusModeActive);
    document.body.classList.toggle('focus-mode', focusModeActive);
    if (focusModeActive) {
      // Mark every content block as dimmable, then highlight the centered one.
      getFocusableBlocks().forEach(el => el.classList.add('focus-dim'));
      requestAnimationFrame(() => updateFocusHighlight());
    } else {
      // Remove all focus classes
      articleBody.querySelectorAll('.focus-dim, .focus-active, .focus-near').forEach(el => {
        el.classList.remove('focus-dim', 'focus-active', 'focus-near');
      });
    }
    if (persist) chrome.storage.sync.set({ focusMode: focusModeActive });
    if (announce) showToast(focusModeActive ? 'Focus mode ON' : 'Focus mode OFF');
  }

  function toggleFocusMode() {
    setFocusMode(!focusModeActive);
  }

  btnFocus.addEventListener('click', toggleFocusMode);

  function updateFocusHighlight() {
    if (!focusModeActive) return;
    const children = getFocusableBlocks();
    if (children.length === 0) return;
    const viewportCenter = window.innerHeight / 2;

    let closestIdx = 0;
    let closestDist = Infinity;

    children.forEach((el, i) => {
      el.classList.remove('focus-active', 'focus-near');
      const rect = el.getBoundingClientRect();
      const elCenter = rect.top + rect.height / 2;
      const dist = Math.abs(elCenter - viewportCenter);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    // Highlight the closest element and its neighbors
    if (children[closestIdx]) children[closestIdx].classList.add('focus-active');
    if (children[closestIdx - 1]) children[closestIdx - 1].classList.add('focus-near');
    if (children[closestIdx + 1]) children[closestIdx + 1].classList.add('focus-near');
  }

  // Update focus on scroll
  let focusRafPending = false;
  window.addEventListener('scroll', () => {
    if (focusModeActive && !focusRafPending) {
      focusRafPending = true;
      requestAnimationFrame(() => {
        updateFocusHighlight();
        focusRafPending = false;
      });
    }
  });

  // ===== Edit Mode =====
  let editModeActive = false;
  const btnEditMode = document.getElementById('btn-editmode');

  function toggleEditMode() {
    editModeActive = !editModeActive;
    btnEditMode.classList.toggle('active', editModeActive);
    if (!editModeActive) {
      articleBody.classList.remove('delete-hover-active');
    }
    showToast(editModeActive ? 'Edit mode ON — hover to delete, double-click to edit' : 'Edit mode OFF');
  }

  btnEditMode.addEventListener('click', toggleEditMode);

  function isEditActive(e) {
    // Edit mode is active if toggle is on OR Alt key is held
    return editModeActive || (e && e.altKey);
  }

  // ===== Click-to-delete (hover X button) =====
  function makeDeletable() {
    const deletableSelectors = 'p, img, figure, blockquote, pre, ul, ol, table, h1, h2, h3, h4, h5, h6';
    const elements = articleBody.querySelectorAll(deletableSelectors);
    elements.forEach((el) => {
      if (el.closest('.code-block-wrapper')) return;
      el.setAttribute('data-deletable', '');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'reader-delete-btn';
    deleteBtn.innerHTML = '&times;';
    deleteBtn.title = 'Remove element (Shift+click: remove all similar)';
    deleteBtn.style.display = 'none';
    document.body.appendChild(deleteBtn);

    let hoveredEl = null;
    let altHeld = false;

    // Track Alt key state for Alt+hover
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Alt' && !editModeActive) {
        altHeld = true;
        articleBody.classList.add('delete-hover-active');
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Alt') {
        altHeld = false;
        if (!editModeActive) {
          articleBody.classList.remove('delete-hover-active');
          hideDeleteBtn();
        }
      }
    });

    articleBody.addEventListener('mouseenter', () => {
      if (editModeActive || altHeld) {
        articleBody.classList.add('delete-hover-active');
      }
    });

    articleBody.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget === deleteBtn || deleteBtn.contains(e.relatedTarget)) return;
      articleBody.classList.remove('delete-hover-active');
      hideDeleteBtn();
    });

    articleBody.addEventListener('mouseover', (e) => {
      if (!editModeActive && !altHeld) {
        hideDeleteBtn();
        return;
      }
      const target = e.target.closest('[data-deletable]');
      if (!target || !articleBody.contains(target)) {
        hideDeleteBtn();
        return;
      }
      if (target === hoveredEl) return;
      hoveredEl = target;
      showDeleteBtn(target);
    });

    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.display = 'flex';
    });

    deleteBtn.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget && articleBody.contains(e.relatedTarget)) return;
      hideDeleteBtn();
    });

    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (hoveredEl) {
        const elToRemove = hoveredEl;
        hoveredEl = null;
        hideDeleteBtn();

        if (e.shiftKey) {
          const similar = findSimilarElements(elToRemove);
          const total = similar.length + 1;
          const allEls = [elToRemove, ...similar];
          const undoItems = allEls.map((el) => ({
            element: el,
            parent: el.parentNode,
            nextSibling: el.nextSibling
          }));
          pushUndo({ type: 'delete', items: undoItems });

          elToRemove.classList.add('deleting');
          similar.forEach((s) => s.classList.add('deleting'));
          setTimeout(() => {
            allEls.forEach((el) => {
              el.classList.remove('deleting');
              el.remove();
            });
          }, 200);
          if (similar.length > 0) {
            showToast(`Removed ${total} similar elements (Ctrl+Z to undo)`);
          }
        } else {
          pushUndo({ type: 'delete', items: [{
            element: elToRemove,
            parent: elToRemove.parentNode,
            nextSibling: elToRemove.nextSibling
          }]});

          elToRemove.classList.add('deleting');
          setTimeout(() => {
            elToRemove.classList.remove('deleting');
            elToRemove.remove();
          }, 200);
        }
      }
    });

    function showDeleteBtn(el) {
      const rect = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      deleteBtn.style.display = 'flex';
      deleteBtn.style.top = (rect.top + scrollY - 12) + 'px';
      deleteBtn.style.left = (rect.right - 24) + 'px';
      el.setAttribute('data-hovered', '');
    }

    function hideDeleteBtn() {
      deleteBtn.style.display = 'none';
      if (hoveredEl) {
        hoveredEl.removeAttribute('data-hovered');
      }
      hoveredEl = null;
    }
  }

  // ===== Double-click to edit text =====
  function makeEditable() {
    articleBody.addEventListener('dblclick', (e) => {
      if (!editModeActive && !e.altKey) return; // Only in edit mode or Alt+dblclick
      const target = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th');
      if (!target || !articleBody.contains(target)) return;
      if (target.closest('pre') || target.closest('.code-block-wrapper')) return;
      if (target.getAttribute('contenteditable') === 'true') return;

      const originalHTML = target.innerHTML;

      target.setAttribute('contenteditable', 'true');
      target.classList.add('reader-editing');
      target.focus();

      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      function exitEdit() {
        target.removeAttribute('contenteditable');
        target.classList.remove('reader-editing');
        target.removeEventListener('blur', onBlur);
        target.removeEventListener('keydown', onKeydown);
        if (target.innerHTML !== originalHTML) {
          pushUndo({ type: 'edit', element: target, oldHTML: originalHTML });
        }
      }

      function onBlur() {
        exitEdit();
      }

      function onKeydown(ev) {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          target.innerHTML = originalHTML;
          target.blur();
        }
      }

      target.addEventListener('blur', onBlur);
      target.addEventListener('keydown', onKeydown);
    });
  }

  // ===== Image resize =====
  function makeImagesResizable() {
    let selectedImages = new Set();
    let resizeBar = null;

    function createResizeBar() {
      resizeBar = document.createElement('div');
      resizeBar.className = 'image-resize-bar';
      resizeBar.innerHTML = `
        <span class="resize-bar-label">Resize:</span>
        <button data-size="25">25%</button>
        <button data-size="50">50%</button>
        <button data-size="75">75%</button>
        <button data-size="100">100%</button>
        <button data-size="original">Original</button>
        <span class="resize-bar-divider"></span>
        <span class="resize-bar-count"></span>
      `;
      resizeBar.style.display = 'none';
      document.body.appendChild(resizeBar);

      resizeBar.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-size]');
        if (!btn) return;
        const size = btn.dataset.size;
        const undoItems = [];
        selectedImages.forEach((img) => {
          undoItems.push({
            element: img,
            oldWidth: img.style.width,
            oldMaxWidth: img.style.maxWidth
          });
          if (size === 'original') {
            img.style.width = '';
            img.style.maxWidth = '100%';
          } else {
            img.style.width = size + '%';
            img.style.maxWidth = 'none';
          }
        });
        pushUndo({ type: 'resize', items: undoItems });
        updateResizeBar();
      });

      return resizeBar;
    }

    function updateResizeBar() {
      if (!resizeBar) createResizeBar();
      if (selectedImages.size === 0) {
        resizeBar.style.display = 'none';
        return;
      }
      resizeBar.style.display = 'flex';
      const countEl = resizeBar.querySelector('.resize-bar-count');
      countEl.textContent = selectedImages.size + ' image' + (selectedImages.size > 1 ? 's' : '') + ' selected';

      resizeBar.style.top = '52px';
      resizeBar.style.left = '50%';
      resizeBar.style.transform = 'translateX(-50%)';
    }

    function selectImage(img) {
      selectedImages.add(img);
      img.classList.add('image-selected');
      updateResizeBar();
    }

    function deselectImage(img) {
      selectedImages.delete(img);
      img.classList.remove('image-selected');
      updateResizeBar();
    }

    function clearSelection() {
      selectedImages.forEach((img) => img.classList.remove('image-selected'));
      selectedImages.clear();
      updateResizeBar();
    }

    articleBody.addEventListener('click', (e) => {
      const img = e.target.closest('#article-body img');
      if (!img) {
        if (!e.ctrlKey && !e.metaKey) {
          clearSelection();
        }
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        if (selectedImages.has(img)) {
          deselectImage(img);
        } else {
          selectImage(img);
        }
      } else {
        clearSelection();
        selectImage(img);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && selectedImages.size > 0) {
        clearSelection();
      }
    });
  }

  // ===== Grouped deletion (Shift+click) =====
  function findSimilarElements(el) {
    const text = el.textContent.trim();
    if (text.length > 80) return [];
    const tag = el.tagName;
    const candidates = articleBody.querySelectorAll(tag + '[data-deletable]');
    const similar = [];
    candidates.forEach((candidate) => {
      if (candidate === el) return;
      const cText = candidate.textContent.trim();
      if (cText.length > 80) return;
      const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalize(cText) === normalize(text)) {
        similar.push(candidate);
      }
    });
    return similar;
  }


  // ===== Toast notification =====
  function showToast(message, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'reader-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ===== Hints (Tips) =====
  function showHintsToast() {
    showHintCards(true); // auto-shown on article load -> fades after 7s
  }

  const HINTS = [
    'Double-click text to edit',
    'Hover + red X to delete',
    'Shift+click X to remove all similar',
    'Click image to resize (Ctrl for multi)',
    'Ignore "debugging started" in PDF export',
  ];

  // autoDismiss=true  -> card fades on its own after a delay (used on article
  //                      load so tips aren't intrusive).
  // autoDismiss=false -> card stays until the user closes it (used when the
  //                      Tips button is clicked, since that's an explicit
  //                      request to read them).
  function showHintCards(autoDismiss = false) {
    // Remove any existing hint card
    const existing = document.querySelector('.reader-hints-card');
    if (existing) {
      existing.classList.add('hint-dismiss');
      existing.addEventListener('animationend', () => existing.remove());
      return;
    }

    const card = document.createElement('div');
    card.className = 'reader-hints-card';

    const header = document.createElement('div');
    header.className = 'hints-card-header';
    header.innerHTML = `<span class="hints-card-title">\u{1F4A1} Tips</span><button class="hint-close" aria-label="Close">\u00D7</button>`;
    card.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'hints-card-list';
    HINTS.forEach((hint) => {
      const li = document.createElement('li');
      li.className = 'hint-item';
      li.textContent = hint;
      list.appendChild(li);
    });
    card.appendChild(list);

    // Close button - smooth dismiss
    header.querySelector('.hint-close').addEventListener('click', () => {
      card.classList.add('hint-dismiss');
      card.addEventListener('animationend', () => card.remove());
    });

    // Must be in the DOM before we can measure its height for positioning.
    document.body.appendChild(card);

    positionHintsCard(card);
    makeHintsCardDraggable(card, header);

    requestAnimationFrame(() => card.classList.add('visible'));

    // Only the auto-shown (on-load) card fades on its own after 7s. Cards
    // opened via the Tips button persist until closed. Dragging cancels the
    // timer either way (see makeHintsCardDraggable).
    if (autoDismiss) {
      hintsAutoDismiss = setTimeout(() => {
        if (document.body.contains(card) && !card.classList.contains('hint-dismiss')) {
          card.classList.add('hint-dismiss');
          card.addEventListener('animationend', () => card.remove());
        }
      }, 7000);
    }
  }

  // Timer handle so dragging can cancel the auto-dismiss.
  let hintsAutoDismiss = null;

  // Remembered custom position for the tips card (once the user drags it).
  let hintsPos = null;
  chrome.storage.sync.get('hintsPos', (result) => {
    if (result && result.hintsPos &&
        typeof result.hintsPos.top === 'number' &&
        typeof result.hintsPos.left === 'number') {
      hintsPos = result.hintsPos;
    }
  });

  // Position the tips card. If the user has dragged it before, restore that
  // (clamped). Otherwise anchor it below the toolbar/gear, then shift it UP if
  // it would overflow the bottom of the viewport so all items stay visible.
  function positionHintsCard(card) {
    const cw = card.offsetWidth;
    const ch = card.offsetHeight;
    const EDGE = 8;

    let top, left;
    if (hintsPos) {
      top = hintsPos.top;
      left = hintsPos.left;
    } else {
      const anchor = rightToolbar.classList.contains('collapsed') ? gearBtn : rightToolbar;
      const rect = anchor.getBoundingClientRect();
      top = (rect.height || rect.width) ? rect.bottom + 12 : 90;
      // Right-align the card under the anchor's right edge.
      const right = (rect.height || rect.width) ? (window.innerWidth - rect.right) : 20;
      left = window.innerWidth - right - cw;
    }

    // Clamp so the whole card (all 5 hints) stays on screen.
    const maxLeft = window.innerWidth - cw - EDGE;
    const maxTop = window.innerHeight - ch - EDGE;
    left = Math.max(EDGE, Math.min(left, maxLeft));
    top = Math.max(EDGE, Math.min(top, maxTop));

    card.style.top = top + 'px';
    card.style.left = left + 'px';
    card.style.right = 'auto';
  }

  // Drag the tips card by its header. Mirrors the toolbar drag: pointer events,
  // viewport clamp, persist to storage.
  function makeHintsCardDraggable(card, header) {
    let dragging = false;
    let startX = 0, startY = 0, originTop = 0, originLeft = 0;
    const EDGE = 8;

    header.addEventListener('pointerdown', (e) => {
      // Ignore drags that start on the close button.
      if (e.target.closest('.hint-close')) return;
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();

      const rect = card.getBoundingClientRect();
      originTop = rect.top;
      originLeft = rect.left;
      startX = e.clientX;
      startY = e.clientY;
      dragging = true;

      card.classList.add('dragging');
      clearTimeout(hintsAutoDismiss); // keep it open while interacting
      try { header.setPointerCapture(e.pointerId); } catch (_) {}
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const cw = card.offsetWidth;
      const ch = card.offsetHeight;
      let top = originTop + (e.clientY - startY);
      let left = originLeft + (e.clientX - startX);
      left = Math.max(EDGE, Math.min(left, window.innerWidth - cw - EDGE));
      top = Math.max(EDGE, Math.min(top, window.innerHeight - ch - EDGE));
      hintsPos = { top, left };
      card.style.top = top + 'px';
      card.style.left = left + 'px';
      card.style.right = 'auto';
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      card.classList.remove('dragging');
      try { header.releasePointerCapture(e.pointerId); } catch (_) {}
      if (hintsPos) chrome.storage.sync.set({ hintsPos: hintsPos });
    }
    header.addEventListener('pointerup', endDrag);
    header.addEventListener('pointercancel', endDrag);
  }

  // Tips button
  btnTips.addEventListener('click', () => {
    showHintCards();
  });

  // ===== Font controls =====
  function applyBodyFont(fontName) {
    document.documentElement.style.setProperty('--body-font', `'${fontName}', 'Helvetica Neue', Arial, sans-serif`);
    updateGoogleFontsLink();
  }

  function applyCodeFont(fontName) {
    document.documentElement.style.setProperty('--code-font', `'${fontName}', 'Consolas', 'Courier New', monospace`);
    updateGoogleFontsLink();
  }

  function applyFontSize(size) {
    document.documentElement.style.setProperty('--font-size', size + 'px');
  }

  function applyCodeFontSize(size) {
    document.documentElement.style.setProperty('--code-font-size', size + 'px');
  }

  function applyTextWeight(weight) {
    document.documentElement.style.setProperty('--text-font-weight', weight);
  }

  function applyCodeWeight(weight) {
    document.documentElement.style.setProperty('--code-font-weight', weight);
  }

  function setWeightActive(group, weight) {
    group.querySelectorAll('.weight-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.weight === weight);
    });
  }

  function updateGoogleFontsLink() {
    const bodyFont = fontSelect.value.replace(/ /g, '+');
    const codeFont = codeFontSelect.value.replace(/ /g, '+');
    const textWeights = new Set(['400', '500', '600', '700']);
    const codeWeights = new Set(['400', '500']);
    const codeWeight = getActiveWeight(codeWeightGroup);
    if (codeWeight !== '400') codeWeights.add(codeWeight);
    const url = `https://fonts.googleapis.com/css2?family=${bodyFont}:wght@${[...textWeights].join(';')}&family=${codeFont}:wght@${[...codeWeights].join(';')}&display=swap`;
    googleFontsLink.href = url;
  }

  function getActiveWeight(group) {
    const active = group.querySelector('.weight-option.active');
    return active ? active.dataset.weight : '400';
  }

  // --- Text font controls ---
  fontSelect.addEventListener('change', () => {
    const font = fontSelect.value;
    applyBodyFont(font);
    chrome.storage.sync.set({ bodyFont: font });
  });

  fontSizeRange.addEventListener('input', () => {
    const size = fontSizeRange.value;
    fontSizeLabel.textContent = size + 'px';
    applyFontSize(size);
    chrome.storage.sync.set({ fontSize: size });
  });

  textWeightGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.weight-option');
    if (!btn) return;
    setWeightActive(textWeightGroup, btn.dataset.weight);
    applyTextWeight(btn.dataset.weight);
    updateGoogleFontsLink();
    chrome.storage.sync.set({ textWeight: btn.dataset.weight });
  });

  // --- Code font controls ---
  codeFontSelect.addEventListener('change', () => {
    const font = codeFontSelect.value;
    applyCodeFont(font);
    chrome.storage.sync.set({ codeFont: font });
  });

  codeSizeRange.addEventListener('input', () => {
    const size = codeSizeRange.value;
    codeSizeLabel.textContent = size + 'px';
    applyCodeFontSize(size);
    chrome.storage.sync.set({ codeFontSize: size });
  });

  codeWeightGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.weight-option');
    if (!btn) return;
    setWeightActive(codeWeightGroup, btn.dataset.weight);
    applyCodeWeight(btn.dataset.weight);
    updateGoogleFontsLink();
    chrome.storage.sync.set({ codeWeight: btn.dataset.weight });
  });

  // ===== Layout density presets =====
  // Sets body[data-density], which drives --line-height / --para-spacing /
  // --content-width via CSS. Font size stays independently slider-controlled.
  const densityGroup = document.getElementById('density-group');

  function applyDensity(density) {
    document.body.setAttribute('data-density', density);
    if (densityGroup) {
      densityGroup.querySelectorAll('.weight-option').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.density === density);
      });
    }
  }

  if (densityGroup) {
    densityGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.weight-option');
      if (!btn) return;
      applyDensity(btn.dataset.density);
      chrome.storage.sync.set({ density: btn.dataset.density });
    });
  }

  // Restore saved density (default comfortable).
  chrome.storage.sync.get('density', (result) => {
    applyDensity((result && result.density) || 'comfortable');
  });

  // ===== Custom CSS =====
  const customCssInput = document.getElementById('custom-css-input');
  let customStyleEl = document.createElement('style');
  customStyleEl.id = 'custom-user-css';
  document.head.appendChild(customStyleEl);

  function applyCustomCss(css) {
    // Guard: if the extension CSP ever blocks inline styles again, don't let it
    // abort the rest of the reader script.
    try {
      customStyleEl.textContent = css || '';
    } catch (e) {
      console.warn('Custom CSS could not be applied:', e);
    }
  }

  if (customCssInput) {
    customCssInput.addEventListener('input', () => {
      const css = customCssInput.value;
      applyCustomCss(css);
      chrome.storage.sync.set({ customCss: css });
    });

    // Restore custom CSS
    chrome.storage.sync.get('customCss', (result) => {
      if (result.customCss) {
        customCssInput.value = result.customCss;
        applyCustomCss(result.customCss);
      }
    });
  }

  // ===== Print =====
  btnPrint.addEventListener('click', () => {
    window.print();
  });

  // ===== PDF Export via Chrome DevTools Protocol =====
  const pdfDialogOverlay = document.getElementById('pdf-dialog-overlay');
  const pdfCancelBtn = document.getElementById('pdf-cancel');
  const pdfGenerateBtn = document.getElementById('pdf-generate');
  const pageSizeSelect = document.getElementById('pdf-page-size');
  const marginTopInput = document.getElementById('margin-top');
  const marginRightInput = document.getElementById('margin-right');
  const marginBottomInput = document.getElementById('margin-bottom');
  const marginLeftInput = document.getElementById('margin-left');
  const marginPresets = document.getElementById('margin-presets');
  const marginCustomRow = document.getElementById('margin-custom-row');

  const MARGIN_PRESETS = {
    none: { top: 0, right: 0, bottom: 0, left: 0 },
    minimal: { top: 5, right: 5, bottom: 5, left: 5 }
  };

  let activeMarginPreset = 'minimal';

  marginPresets.addEventListener('click', (e) => {
    const btn = e.target.closest('.margin-preset-btn');
    if (!btn) return;

    const preset = btn.dataset.preset;
    activeMarginPreset = preset;

    marginPresets.querySelectorAll('.margin-preset-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

    if (preset === 'custom') {
      marginCustomRow.classList.remove('hidden');
    } else {
      marginCustomRow.classList.add('hidden');
    }
  });

  btnPdf.addEventListener('click', () => {
    pdfDialogOverlay.classList.remove('hidden');
  });

  pdfCancelBtn.addEventListener('click', () => {
    pdfDialogOverlay.classList.add('hidden');
  });

  pdfDialogOverlay.addEventListener('click', (e) => {
    if (e.target === pdfDialogOverlay) {
      pdfDialogOverlay.classList.add('hidden');
    }
  });

  const pdfTocCheckbox = document.getElementById('pdf-toc');

  pdfGenerateBtn.addEventListener('click', async () => {
    pdfDialogOverlay.classList.add('hidden');
    btnPdf.disabled = true;
    btnPdf.title = 'Generating...';

    // Always export PDF in light mode
    const wasDark = document.body.classList.contains('dark');
    if (wasDark) document.body.classList.remove('dark');

    // Inject TOC if requested
    let tocElement = null;
    if (pdfTocCheckbox.checked) {
      tocElement = buildTocPage();
    }

    try {
      await generatePdf();
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + err.message);
    } finally {
      // Remove TOC element if it was added
      if (tocElement) tocElement.remove();
      // Restore dark mode if it was active
      if (wasDark) document.body.classList.add('dark');
      btnPdf.disabled = false;
      btnPdf.title = 'Save as PDF (Alt+S)';
    }
  });

  function buildTocPage() {
    const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
    if (headings.length === 0) return null;

    const toc = document.createElement('div');
    toc.className = 'pdf-toc-page';

    // Article title + meta header
    const header = document.createElement('div');
    header.className = 'pdf-toc-header';

    const title = document.createElement('h1');
    title.className = 'pdf-toc-article-title';
    title.textContent = articleData ? articleData.title : document.title;
    header.appendChild(title);

    if (articleData && (articleData.byline || articleData.url)) {
      const meta = document.createElement('p');
      meta.className = 'pdf-toc-article-meta';
      const parts = [];
      if (articleData.byline) parts.push(articleData.byline);
      if (articleData.url) {
        const domain = new URL(articleData.url).hostname;
        parts.push(domain);
      }
      meta.textContent = parts.join(' \u2022 ');
      header.appendChild(meta);
    }

    toc.appendChild(header);

    // Contents heading
    const contentsHeading = document.createElement('h2');
    contentsHeading.className = 'pdf-toc-heading';
    contentsHeading.textContent = 'Contents';
    toc.appendChild(contentsHeading);

    // TOC list with dotted leaders
    const list = document.createElement('ul');
    list.className = 'pdf-toc-list';

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName.charAt(1));
      const li = document.createElement('li');
      li.className = 'pdf-toc-item pdf-toc-level-' + level;

      const textSpan = document.createElement('span');
      textSpan.className = 'pdf-toc-item-text';
      textSpan.textContent = heading.textContent.trim();

      const dotsSpan = document.createElement('span');
      dotsSpan.className = 'pdf-toc-item-dots';
      dotsSpan.textContent = '\u00B7'.repeat(200); // Fill with middle dots, overflow hidden trims

      li.appendChild(textSpan);
      li.appendChild(dotsSpan);
      list.appendChild(li);
    });

    toc.appendChild(list);

    // Insert before article content
    const readerContent = document.getElementById('reader-content');
    readerContent.insertBefore(toc, readerContent.firstChild);

    return toc;
  }

  async function generatePdf() {
    const title = articleData ? articleData.title : 'Article';

    let mTop, mRight, mBottom, mLeft;
    if (activeMarginPreset === 'custom') {
      mTop = parseInt(marginTopInput.value) || 0;
      mRight = parseInt(marginRightInput.value) || 0;
      mBottom = parseInt(marginBottomInput.value) || 0;
      mLeft = parseInt(marginLeftInput.value) || 0;
    } else {
      const preset = MARGIN_PRESETS[activeMarginPreset];
      mTop = preset.top;
      mRight = preset.right;
      mBottom = preset.bottom;
      mLeft = preset.left;
    }
    const pageSize = pageSizeSelect.value || 'a4';

    const tab = await chrome.tabs.getCurrent();
    const tabId = tab ? tab.id : undefined;

    if (!tabId) {
      throw new Error('Could not determine current tab ID');
    }

    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_PDF',
      tabId: tabId,
      options: {
        filename: sanitizeFilename(title) + '.pdf',
        pageSize: pageSize,
        marginTop: mTop,
        marginRight: mRight,
        marginBottom: mBottom,
        marginLeft: mLeft
      }
    });

    if (!response || !response.success) {
      throw new Error((response && response.error) || 'PDF generation failed');
    }
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9\-_ ]/gi, '').substring(0, 100).trim() || 'article';
  }

  // ===== Export as Markdown =====
  const btnMarkdown = document.getElementById('btn-markdown');

  btnMarkdown.addEventListener('click', () => {
    const markdown = htmlToMarkdown(articleBody);
    const title = articleData ? articleData.title : 'Article';
    const header = `# ${title}\n\n`;
    const meta = articleData && articleData.url ? `> Source: ${articleData.url}\n\n` : '';
    const fullMd = header + meta + markdown;

    // Download as .md file
    const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(title) + '.md';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Markdown exported');
  });

  function htmlToMarkdown(container) {
    let md = '';
    const children = container.childNodes;

    for (const node of children) {
      if (node.nodeType === Node.TEXT_NODE) {
        md += node.textContent;
        continue;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) continue;

      const tag = node.tagName.toLowerCase();

      switch (tag) {
        case 'h1': md += '\n## ' + node.textContent.trim() + '\n\n'; break;
        case 'h2': md += '\n### ' + node.textContent.trim() + '\n\n'; break;
        case 'h3': md += '\n#### ' + node.textContent.trim() + '\n\n'; break;
        case 'h4': md += '\n##### ' + node.textContent.trim() + '\n\n'; break;
        case 'h5': case 'h6':
          md += '\n###### ' + node.textContent.trim() + '\n\n'; break;
        case 'p':
          md += inlineToMarkdown(node) + '\n\n'; break;
        case 'blockquote':
          const bqLines = node.textContent.trim().split('\n');
          md += bqLines.map(l => '> ' + l).join('\n') + '\n\n'; break;
        case 'pre': {
          md += preToMarkdown(node); break;
        }
        case 'ul': {
          const items = node.querySelectorAll(':scope > li');
          items.forEach(li => { md += '- ' + inlineToMarkdown(li).trim() + '\n'; });
          md += '\n'; break;
        }
        case 'ol': {
          const items = node.querySelectorAll(':scope > li');
          items.forEach((li, i) => { md += (i + 1) + '. ' + inlineToMarkdown(li).trim() + '\n'; });
          md += '\n'; break;
        }
        case 'figure': {
          const img = node.querySelector('img');
          const caption = node.querySelector('figcaption');
          if (img) {
            const alt = caption ? caption.textContent.trim() : (img.alt || '');
            md += '![' + alt + '](' + (img.src || '') + ')\n\n';
          }
          break;
        }
        case 'img':
          md += '![' + (node.alt || '') + '](' + (node.src || '') + ')\n\n'; break;
        case 'table': {
          const rows = node.querySelectorAll('tr');
          rows.forEach((row, ri) => {
            const cells = row.querySelectorAll('th, td');
            const line = '| ' + Array.from(cells).map(c => c.textContent.trim()).join(' | ') + ' |';
            md += line + '\n';
            if (ri === 0) {
              md += '| ' + Array.from(cells).map(() => '---').join(' | ') + ' |\n';
            }
          });
          md += '\n'; break;
        }
        case 'hr':
          md += '---\n\n'; break;
        default: {
          // A wrapper (e.g. <div class="highlight language-python"> or <div class="cell">)
          // that contains exactly one <pre> should be treated as a single code block,
          // otherwise recursing flattens its newlines into a single line.
          const pre = node.querySelector && node.querySelector('pre');
          if (pre && node.querySelectorAll('pre').length === 1) {
            md += preToMarkdown(pre, node);
          } else if (node.children.length > 0) {
            md += htmlToMarkdown(node);
          } else if (node.textContent.trim()) {
            md += node.textContent.trim() + '\n\n';
          }
        }
      }
    }
    return md;
  }

  // Convert a <pre> (optionally with a wrapper carrying the language class) to a
  // fenced code block, preserving internal newlines and indentation.
  function preToMarkdown(pre, wrapper) {
    const code = pre.querySelector('code');
    const source = code || pre;
    let text = extractCodeText(source);
    text = text.replace(/^\n+/, '').replace(/[ \t\n]+$/, '');

    // Derive language ONLY from real page hints. Ignore languages that the
    // reader's highlighter auto-guessed (flagged data-lang-auto), since those
    // are frequently wrong (e.g. Python detected as "go"/"kotlin"/"css").
    let lang = '';
    if (pre.getAttribute('data-lang') && pre.getAttribute('data-lang-auto') !== 'true') {
      lang = pre.getAttribute('data-lang');
    }
    if (!lang) {
      const cls = [pre, code, wrapper]
        .filter(Boolean)
        .map(el => el.className || '')
        .join(' ');
      const m = cls.match(/(?:language|lang)-([a-z0-9+#]+)/i);
      if (m && m[1].toLowerCase() !== 'plain') lang = m[1];
    }

    return '```' + lang + '\n' + text + '\n```\n\n';
  }

  // Extract code text with real line breaks. Some highlighters emit each line as
  // a separate block element with NO "\n" text nodes between them, so plain
  // textContent collapses everything onto one line. Walk the DOM and insert a
  // newline at every hard line break (<br>) and block-level boundary, with
  // innerText / textContent as fallbacks.
  function extractCodeText(source) {
    // If textContent already has newlines, it's reliable.
    const raw = source.textContent || '';
    if (raw.indexOf('\n') !== -1) return raw;

    // Manual walk: reconstruct newlines from <br> and block-level children.
    const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'TR', 'SECTION', 'SPAN']);
    let out = '';
    const walk = (node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          out += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName;
          if (tag === 'BR') {
            out += '\n';
            return;
          }
          // A "line" is typically a direct block-level child of the code element.
          const isLine = child.parentNode === source && BLOCK_TAGS.has(tag);
          walk(child);
          if (isLine && !out.endsWith('\n')) out += '\n';
        }
      });
    };
    walk(source);

    // If the walk still produced no line breaks, fall back to innerText
    // (respects rendered line boxes), then to the raw textContent.
    if (out.indexOf('\n') === -1) {
      const it = (source.innerText || '').replace(/\r\n/g, '\n');
      if (it.indexOf('\n') !== -1) return it;
    }
    return out || raw;
  }

  function inlineToMarkdown(el) {
    let result = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tag = node.tagName.toLowerCase();
        const text = node.textContent;
        if (tag === 'strong' || tag === 'b') {
          result += '**' + text + '**';
        } else if (tag === 'em' || tag === 'i') {
          result += '*' + text + '*';
        } else if (tag === 'code') {
          result += '`' + text + '`';
        } else if (tag === 'a') {
          result += '[' + text + '](' + (node.href || '') + ')';
        } else if (tag === 'img') {
          result += '![' + (node.alt || '') + '](' + (node.src || '') + ')';
        } else {
          result += text;
        }
      }
    }
    return result;
  }

})();
