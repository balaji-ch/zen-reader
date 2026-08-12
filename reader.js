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
        // Re-insert the removed element(s) at their original positions
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
        // Restore original innerHTML
        action.element.innerHTML = action.oldHTML;
        showToast('Undo: text reverted');
        break;
      }
      case 'resize': {
        // Restore original width/maxWidth for each image
        action.items.forEach((item) => {
          item.element.style.width = item.oldWidth;
          item.element.style.maxWidth = item.oldMaxWidth;
        });
        showToast('Undo: image resize reverted');
        break;
      }
      case 'cleanup': {
        // Re-insert all cleaned-up elements
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
      // Don't intercept if user is editing text (contenteditable)
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
  const textFontTrigger = document.getElementById('text-font-trigger');
  const codeFontTrigger = document.getElementById('code-font-trigger');
  const textFontName = document.getElementById('text-font-name');
  const codeFontNameEl = document.getElementById('code-font-name');
  const textPopover = document.getElementById('text-popover');
  const codePopover = document.getElementById('code-popover');
  const btnPrint = document.getElementById('btn-print');
  const btnPdf = document.getElementById('btn-pdf');
  const googleFontsLink = document.getElementById('google-fonts-link');

  // ===== Popover logic =====
  function togglePopover(popover, trigger) {
    const isVisible = popover.classList.contains('visible');
    closeAllPopovers();
    if (!isVisible) {
      popover.classList.add('visible');
      trigger.classList.add('active');
      // Position popover below the trigger
      const rect = trigger.getBoundingClientRect();
      popover.style.left = rect.left + 'px';
      popover.style.transform = 'none';
      popover.style.top = (rect.bottom + 4) + 'px';
    }
  }

  function closeAllPopovers() {
    textPopover.classList.remove('visible');
    codePopover.classList.remove('visible');
    textFontTrigger.classList.remove('active');
    codeFontTrigger.classList.remove('active');
  }

  textFontTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(textPopover, textFontTrigger);
  });

  codeFontTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover(codePopover, codeFontTrigger);
  });

  // Close popovers when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.font-popover') && !e.target.closest('.font-trigger')) {
      closeAllPopovers();
    }
  });

  // Prevent popover clicks from closing
  textPopover.addEventListener('click', (e) => e.stopPropagation());
  codePopover.addEventListener('click', (e) => e.stopPropagation());

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
      textFontName.textContent = prefs.bodyFont;
      applyBodyFont(prefs.bodyFont);
    }
    if (prefs.codeFont) {
      codeFontSelect.value = prefs.codeFont;
      codeFontNameEl.textContent = prefs.codeFont;
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

    // Constrain small decorative/inline images (arrows, icons, etc.)
    constrainDecorativeImages();

    // Process code blocks
    processCodeBlocks();

    // Make elements deletable
    makeDeletable();

    // Make text editable on double-click
    makeEditable();

    // Make images resizable
    makeImagesResizable();

    // Show hints toast
    showHintsToast();
  }

  // ===== Constrain decorative/inline images (arrows, bullets, small icons) =====
  function constrainDecorativeImages() {
    const images = articleBody.querySelectorAll('img');
    images.forEach((img) => {
      // Wait for image to load to check natural dimensions
      const check = () => {
        const natW = img.naturalWidth;
        const natH = img.naturalHeight;
        // If image has very small natural dimensions, it's likely a decorative icon
        // (arrows, bullet points, section markers, emoji-like icons)
        if (natW > 0 && natH > 0 && natW <= 40 && natH <= 40) {
          img.style.display = 'inline';
          img.style.verticalAlign = 'middle';
          img.style.margin = '0 0.15em';
          img.style.borderRadius = '0';
          img.style.maxHeight = '1.2em';
          img.style.width = 'auto';
          img.style.maxWidth = 'none';
        }
        // Also handle slightly larger icons (up to ~64px) that are clearly not article images
        // These often appear as section arrows or decorative separators
        else if (natW > 0 && natH > 0 && natW <= 64 && natH <= 64) {
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

  // ===== Process code blocks: detect language, add badges, highlight =====
  function processCodeBlocks() {
    const preBlocks = articleBody.querySelectorAll('pre');

    preBlocks.forEach((pre) => {
      const code = pre.querySelector('code');
      if (!code) return;

      // Detect language from class attributes
      let lang = detectLanguage(code) || detectLanguage(pre);

      // If no language detected, try auto-detection with highlight.js
      if (!lang && code.textContent.trim().length > 0) {
        const result = hljs.highlightAuto(code.textContent);
        if (result.language && result.relevance > 5) {
          lang = result.language;
        }
      }

      // Apply highlighting
      if (lang) {
        pre.setAttribute('data-lang', lang);

        // Only highlight if not already highlighted
        if (!code.querySelector('.hljs-keyword, .hljs-string, .hljs-comment')) {
          try {
            const highlighted = hljs.highlight(code.textContent, { language: lang });
            code.innerHTML = highlighted.value;
          } catch (e) {
            // Language not supported, try auto
            const result = hljs.highlightAuto(code.textContent);
            code.innerHTML = result.value;
            if (result.language) {
              lang = result.language;
              pre.setAttribute('data-lang', lang);
            }
          }
        }


      } else {
        // Plain code block - no badge, default blue border
        if (!code.querySelector('.hljs-keyword, .hljs-string, .hljs-comment')) {
          const result = hljs.highlightAuto(code.textContent);
          if (result.language && result.relevance > 3) {
            code.innerHTML = result.value;
            lang = result.language;
            pre.setAttribute('data-lang', lang);

          }
        }
      }

      // Ensure proper formatting
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
      // Don't hide if the mouse is moving to the delete button
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
      // Don't hide if the mouse is moving back to a deletable element inside articleBody
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
          // Grouped deletion: find and remove all similar elements
          const similar = findSimilarElements(elToRemove);
          const total = similar.length + 1;
          // Record undo info before removing
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
          // Record undo info
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

      // Save original content for undo
      const originalHTML = target.innerHTML;

      target.setAttribute('contenteditable', 'true');
      target.classList.add('reader-editing');
      target.focus();

      // Select all text in the element for easy replacement
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
        // Push undo only if content actually changed
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
          // Restore original on Escape
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
        // Record undo info before resizing
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
        // Keep selection to allow further resizing
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

      // Position the bar near the top of viewport
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
        // Click outside image — clear unless Ctrl held
        if (!e.ctrlKey && !e.metaKey) {
          clearSelection();
        }
        return;
      }

      // Prevent deselecting when clicking on a selected image without Ctrl
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Toggle selection
        if (selectedImages.has(img)) {
          deselectImage(img);
        } else {
          selectImage(img);
        }
      } else {
        // Single select — clear others
        clearSelection();
        selectImage(img);
      }
    });

    // Clear selection on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && selectedImages.size > 0) {
        clearSelection();
      }
    });
  }

  // ===== Grouped deletion (Shift+click) =====
  function findSimilarElements(el) {
    const text = el.textContent.trim();
    if (text.length > 80) return []; // Only group short elements
    const tag = el.tagName;
    const candidates = articleBody.querySelectorAll(tag + '[data-deletable]');
    const similar = [];
    candidates.forEach((candidate) => {
      if (candidate === el) return;
      const cText = candidate.textContent.trim();
      if (cText.length > 80) return;
      // Exact match or very similar (same normalized text)
      const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
      if (normalize(cText) === normalize(text)) {
        similar.push(candidate);
      }
    });
    return similar;
  }

  // ===== Cleanup button =====
  const btnCleanup = document.getElementById('btn-cleanup');
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
      if (text.length > 100) return; // Only target short noise
      for (const pattern of noisePatterns) {
        if (pattern.test(text)) {
          toRemove.push(el);
          break;
        }
      }
    });

    if (toRemove.length > 0) {
      // Record undo info
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

    // Show feedback
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
    // Trigger animation
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ===== Hints toast on first load =====
  function showHintsToast() {
    const hints = [
      'Double-click text to edit',
      'Shift+click delete to remove all similar',
      'Click image to resize (Ctrl+click for multiple)',
      'Ctrl+Z to undo',
    ];
    const toast = document.createElement('div');
    toast.className = 'reader-hints-toast';
    toast.innerHTML = '<strong>Tips:</strong> ' + hints.join(' &bull; ');
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, 15000);
  }

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
    const textWeight = getActiveWeight(textWeightGroup);
    const codeWeight = getActiveWeight(codeWeightGroup);
    // Build weight list for each font
    const textWeights = new Set(['400', '500', '600', '700']);
    const codeWeights = new Set(['400', '500']);
    if (codeWeight !== '400') codeWeights.add(codeWeight);
    const url = `https://fonts.googleapis.com/css2?family=${bodyFont}:wght@${[...textWeights].join(';')}&family=${codeFont}:wght@${[...codeWeights].join(';')}&display=swap`;
    googleFontsLink.href = url;
  }

  function getActiveWeight(group) {
    const active = group.querySelector('.weight-option.active');
    return active ? active.dataset.weight : '400';
  }

  // --- Text popover controls ---
  fontSelect.addEventListener('change', () => {
    const font = fontSelect.value;
    textFontName.textContent = font;
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

  // --- Code popover controls ---
  codeFontSelect.addEventListener('change', () => {
    const font = codeFontSelect.value;
    codeFontNameEl.textContent = font;
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

  // ===== PDF Export with bookmarks =====
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

  // Margin preset definitions (in mm)
  const MARGIN_PRESETS = {
    none: { top: 0, right: 0, bottom: 0, left: 0 },
    minimal: { top: 5, right: 5, bottom: 5, left: 5 }
  };

  let activeMarginPreset = 'minimal';

  // Handle margin preset button clicks
  marginPresets.addEventListener('click', (e) => {
    const btn = e.target.closest('.margin-preset-btn');
    if (!btn) return;

    const preset = btn.dataset.preset;
    activeMarginPreset = preset;

    // Update active state
    marginPresets.querySelectorAll('.margin-preset-btn').forEach((b) => {
      b.classList.toggle('active', b === btn);
    });

    // Show/hide custom margin inputs
    if (preset === 'custom') {
      marginCustomRow.classList.remove('hidden');
    } else {
      marginCustomRow.classList.add('hidden');
    }
  });

  // Show dialog on PDF button click
  btnPdf.addEventListener('click', () => {
    pdfDialogOverlay.classList.remove('hidden');
  });

  // Cancel dialog
  pdfCancelBtn.addEventListener('click', () => {
    pdfDialogOverlay.classList.add('hidden');
  });

  // Close dialog on overlay click
  pdfDialogOverlay.addEventListener('click', (e) => {
    if (e.target === pdfDialogOverlay) {
      pdfDialogOverlay.classList.add('hidden');
    }
  });

  // Generate PDF from dialog
  pdfGenerateBtn.addEventListener('click', async () => {
    pdfDialogOverlay.classList.add('hidden');
    btnPdf.disabled = true;
    btnPdf.textContent = 'Generating...';

    try {
      await generatePdf();
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed: ' + err.message);
    } finally {
      btnPdf.disabled = false;
      btnPdf.textContent = 'PDF';
    }
  });

  async function generatePdf() {
    const element = document.getElementById('reader-content');
    const title = articleData ? articleData.title : 'Article';

    // Resolve margins based on selected preset
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

    // Strip interactive visuals before rendering PDF
    articleBody.classList.remove('delete-hover-active');
    articleBody.querySelectorAll('[data-hovered]').forEach((el) => {
      el.removeAttribute('data-hovered');
    });
    articleBody.querySelectorAll('.reader-editing').forEach((el) => {
      el.removeAttribute('contenteditable');
      el.classList.remove('reader-editing');
    });
    articleBody.querySelectorAll('.image-selected').forEach((el) => {
      el.classList.remove('image-selected');
    });
    // Hide resize bar during PDF
    const resizeBarEl = document.querySelector('.image-resize-bar');
    if (resizeBarEl) resizeBarEl.style.display = 'none';

    // Temporarily wrap headings + next sibling to prevent orphan headings at page bottom
    const wrappers = wrapHeadingsWithContent(element);

    const headings = collectHeadings(element);

    const opt = {
      margin: [mTop, mRight, mBottom, mLeft],
      filename: sanitizeFilename(title) + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: {
        unit: 'mm',
        format: pageSize,
        orientation: 'portrait'
      },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    const worker = html2pdf().set(opt).from(element);

    await worker.toPdf().get('pdf').then((pdf) => {
      if (headings.length > 0) {
        addPdfBookmarks(pdf, headings, element);
      }
    }).save();

    // Unwrap after PDF generation to restore original DOM
    unwrapHeadingsFromContent(wrappers);
  }

  function wrapHeadingsWithContent(container) {
    const wrappers = [];
    const headingEls = container.querySelectorAll('#article-body h1, #article-body h2, #article-body h3, #article-body h4, #article-body h5, #article-body h6');

    headingEls.forEach(heading => {
      const next = heading.nextElementSibling;
      // Only wrap if there's a next sibling and it's not another heading
      if (next && !/^H[1-6]$/.test(next.tagName)) {
        const wrapper = document.createElement('div');
        wrapper.className = 'pdf-heading-group';
        wrapper.style.pageBreakInside = 'avoid';
        wrapper.style.breakInside = 'avoid';
        heading.parentNode.insertBefore(wrapper, heading);
        wrapper.appendChild(heading);
        wrapper.appendChild(next);
        wrappers.push(wrapper);
      }
    });

    return wrappers;
  }

  function unwrapHeadingsFromContent(wrappers) {
    wrappers.forEach(wrapper => {
      const parent = wrapper.parentNode;
      while (wrapper.firstChild) {
        parent.insertBefore(wrapper.firstChild, wrapper);
      }
      parent.removeChild(wrapper);
    });
  }

  function collectHeadings(container) {
    const headings = [];
    const hElements = container.querySelectorAll('h1, h2, h3, h4');
    hElements.forEach((h) => {
      const level = parseInt(h.tagName.charAt(1));
      headings.push({
        text: h.textContent.trim(),
        level: level,
        element: h
      });
    });
    return headings;
  }

  function addPdfBookmarks(pdf, headings, container) {
    if (!pdf.outline || !pdf.outline.add) {
      console.warn('PDF outline API not available in this version of jsPDF');
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const contentHeight = containerRect.height;

    let parentStack = [null];

    headings.forEach((heading) => {
      const rect = heading.element.getBoundingClientRect();
      const yPos = (rect.top - containerRect.top) / contentHeight;
      const page = Math.floor(yPos * (pdf.internal.getNumberOfPages())) + 1;

      while (parentStack.length > heading.level) {
        parentStack.pop();
      }
      const parent = parentStack[parentStack.length - 1];

      try {
        const bookmark = pdf.outline.add(parent, heading.text, { pageNumber: page });
        while (parentStack.length <= heading.level) {
          parentStack.push(bookmark);
        }
      } catch (e) {
        console.warn('Could not add bookmark:', heading.text, e);
      }
    });
  }

  function sanitizeFilename(name) {
    return name.replace(/[^a-z0-9\-_ ]/gi, '').substring(0, 100).trim() || 'article';
  }

})();
