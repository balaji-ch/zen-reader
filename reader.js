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
      case 'cleanup': {
        action.items.forEach((item) => {
          if (item.nextSibling && item.parent.contains(item.nextSibling)) {
            item.parent.insertBefore(item.element, item.nextSibling);
          } else if (item.parent) {
            item.parent.appendChild(item.element);
          }
        });
        showToast('Undo: restored ' + action.items.length + ' cleaned element' + (action.items.length > 1 ? 's' : ''));
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
  const btnCleanup = document.getElementById('btn-cleanup');
  const bookmarksPanel = document.getElementById('bookmarks-panel');
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarksClose = document.querySelector('.bookmarks-close');
  const appearancePopover = document.getElementById('appearance-popover');

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

  // Reset timer on toolbar interaction
  rightToolbar.addEventListener('mouseenter', () => {
    clearTimeout(collapseTimer);
  });

  rightToolbar.addEventListener('mouseleave', () => {
    startCollapseTimer();
  });

  // Start the initial collapse timer
  startCollapseTimer();

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
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight active
        bookmarksList.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      });
      bookmarksList.appendChild(link);
    });
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

  // Update active bookmark on scroll
  function updateActiveBookmark() {
    const headings = articleBody.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let current = null;
    headings.forEach((heading) => {
      const rect = heading.getBoundingClientRect();
      if (rect.top <= 100) {
        current = heading;
      }
    });
    if (current) {
      bookmarksList.querySelectorAll('a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
      });
    }
  }

  let scrollTimeout;
  window.addEventListener('scroll', () => {
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

    // Show hints toast
    showHintsToast();
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

      let lang = detectLanguage(code) || detectLanguage(pre);

      if (!lang && code.textContent.trim().length > 0) {
        const result = hljs.highlightAuto(code.textContent);
        if (result.language && result.relevance > 5) {
          lang = result.language;
        }
      }

      if (lang) {
        pre.setAttribute('data-lang', lang);
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

    articleBody.addEventListener('mouseenter', () => {
      articleBody.classList.add('delete-hover-active');
    });

    articleBody.addEventListener('mouseleave', (e) => {
      if (e.relatedTarget === deleteBtn || deleteBtn.contains(e.relatedTarget)) return;
      articleBody.classList.remove('delete-hover-active');
      hideDeleteBtn();
    });

    articleBody.addEventListener('mouseover', (e) => {
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

  // ===== Cleanup button =====
  btnCleanup.addEventListener('click', () => {
    const noisePatterns = [
      /click\s*(below\s*)?to\s*(see\s*)?full\s*size/i,
      /click\s*(here\s*)?to\s*view\s*(in\s*)?full/i,
      /tap\s*to\s*(view|see|expand)/i,
      /image\s*by\s*author/i,
      /source:\s*author/i,
      /click\s*(to\s*)?(enlarge|expand|zoom)/i,
      /full[\s-]?size\s*image/i,
      /click\s*for\s*larger\s*(image|view)/i,
      /view\s*larger/i,
    ];

    const candidates = articleBody.querySelectorAll('p, figcaption, span, em, small');
    const toRemove = [];

    candidates.forEach((el) => {
      const text = el.textContent.trim();
      if (text.length > 100) return;
      for (const pattern of noisePatterns) {
        if (pattern.test(text)) {
          toRemove.push(el);
          break;
        }
      }
    });

    if (toRemove.length > 0) {
      const undoItems = toRemove.map((el) => ({
        element: el,
        parent: el.parentNode,
        nextSibling: el.nextSibling
      }));
      pushUndo({ type: 'cleanup', items: undoItems });

      toRemove.forEach((el) => el.classList.add('deleting'));
      setTimeout(() => {
        toRemove.forEach((el) => {
          el.classList.remove('deleting');
          el.remove();
        });
      }, 200);
    }

    showToast(toRemove.length > 0
      ? `Removed ${toRemove.length} noisy element${toRemove.length > 1 ? 's' : ''} (Ctrl+Z to undo)`
      : 'No noise patterns found');
  });

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
    showHintCards();
  }

  const HINTS = [
    'Double-click text to edit',
    'Hover + red X to delete',
    'Shift+click X to remove all similar',
    'Click image to resize (Ctrl for multi)',
    'Ignore "debugging started" in PDF export',
  ];

  function showHintCards() {
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
    HINTS.forEach((hint, i) => {
      const li = document.createElement('li');
      li.className = `hint-item hint-item-${i + 1}`;
      li.textContent = hint;
      list.appendChild(li);
    });
    card.appendChild(list);

    // Close button - smooth dismiss
    header.querySelector('.hint-close').addEventListener('click', () => {
      card.classList.add('hint-dismiss');
      card.addEventListener('animationend', () => card.remove());
    });

    document.body.appendChild(card);
    requestAnimationFrame(() => card.classList.add('visible'));

    // Auto-dismiss after 7 seconds with smooth fade
    setTimeout(() => {
      if (document.body.contains(card) && !card.classList.contains('hint-dismiss')) {
        card.classList.add('hint-dismiss');
        card.addEventListener('animationend', () => card.remove());
      }
    }, 7000);
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

  pdfGenerateBtn.addEventListener('click', async () => {
    pdfDialogOverlay.classList.add('hidden');
    btnPdf.disabled = true;
    btnPdf.title = 'Generating...';

    try {
      await generatePdf();
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + err.message);
    } finally {
      btnPdf.disabled = false;
      btnPdf.title = 'Save as PDF';
    }
  });

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

})();
