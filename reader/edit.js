// ZenReader - Edit module (delete, editable, image resize, focus mode)
'use strict';

import { showToast, pushUndo } from './state.js';
import { onEditModeActivated } from './tips.js';

const articleBody = document.getElementById('article-body');
const btnFocus = document.getElementById('btn-focus');
const btnEditMode = document.getElementById('btn-editmode');

// ===== Focus Mode =====
let focusModeActive = false;

function getContentContainer() {
  let container = articleBody;
  for (let i = 0; i < 4; i++) {
    const blockChildren = Array.from(container.children).filter(el =>
      /^(P|H1|H2|H3|H4|H5|H6|PRE|BLOCKQUOTE|UL|OL|TABLE|FIGURE|IMG)$/.test(el.tagName));
    if (blockChildren.length >= 2) return container;
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

export function setFocusMode(on, { persist = true, announce = true } = {}) {
  focusModeActive = on;
  btnFocus.classList.toggle('active', focusModeActive);
  document.body.classList.toggle('focus-mode', focusModeActive);
  if (focusModeActive) {
    getFocusableBlocks().forEach(el => el.classList.add('focus-dim'));
    requestAnimationFrame(() => updateFocusHighlight());
  } else {
    articleBody.querySelectorAll('.focus-dim, .focus-active, .focus-near').forEach(el => {
      el.classList.remove('focus-dim', 'focus-active', 'focus-near');
    });
  }
  if (persist) chrome.storage.sync.set({ focusMode: focusModeActive });
  if (announce) showToast(focusModeActive ? 'Focus mode ON' : 'Focus mode OFF');
}

export function toggleFocusMode() {
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

  if (children[closestIdx]) children[closestIdx].classList.add('focus-active');
  if (children[closestIdx - 1]) children[closestIdx - 1].classList.add('focus-near');
  if (children[closestIdx + 1]) children[closestIdx + 1].classList.add('focus-near');
}

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

export function toggleEditMode() {
  editModeActive = !editModeActive;
  btnEditMode.classList.toggle('active', editModeActive);
  if (!editModeActive) {
    articleBody.classList.remove('delete-hover-active');
  }
  showToast(editModeActive ? 'Edit mode ON' : 'Edit mode OFF');
  if (editModeActive) {
    onEditModeActivated();
  }
}

btnEditMode.addEventListener('click', toggleEditMode);

function isEditActive(e) {
  return editModeActive || (e && e.altKey);
}

// ===== Click-to-delete (hover X button) =====
export function makeDeletable() {
  const deletableSelectors = 'p, img, figure, blockquote, pre, ul, ol, table, h1, h2, h3, h4, h5, h6';
  const elements = articleBody.querySelectorAll(deletableSelectors);
  elements.forEach((el) => {
    if (el.closest('.code-block-wrapper')) return;
    el.setAttribute('data-deletable', '');
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'reader-delete-btn';
  deleteBtn.textContent = '\u00D7';
  deleteBtn.title = 'Remove element (Shift+click: remove all similar)';
  deleteBtn.style.display = 'none';
  document.body.appendChild(deleteBtn);

  let hoveredEl = null;
  let altHeld = false;

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
export function makeEditable() {
  articleBody.addEventListener('dblclick', (e) => {
    if (!editModeActive && !e.altKey) return;
    const target = e.target.closest('p, h1, h2, h3, h4, h5, h6, li, blockquote, td, th');
    if (!target || !articleBody.contains(target)) return;
    if (target.closest('pre') || target.closest('.code-block-wrapper')) return;
    if (target.getAttribute('contenteditable') === 'true') return;

    const originalHTML = target.innerHTML;
    const parser = new DOMParser();
    const originalDoc = parser.parseFromString(originalHTML, 'text/html');
    const originalFragment = document.createDocumentFragment();
    while (originalDoc.body.firstChild) {
      originalFragment.appendChild(originalDoc.body.firstChild);
    }

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
        target.replaceChildren();
        target.appendChild(originalFragment.cloneNode(true));
        target.blur();
      }
    }

    target.addEventListener('blur', onBlur);
    target.addEventListener('keydown', onKeydown);
  });
}

// ===== Image resize =====
export function makeImagesResizable() {
  let selectedImages = new Set();
  let resizeBar = null;

  function createResizeBar() {
    resizeBar = document.createElement('div');
    resizeBar.className = 'image-resize-bar';
    const label = document.createElement('span');
    label.className = 'resize-bar-label';
    label.textContent = 'Resize:';
    resizeBar.appendChild(label);
    [25, 50, 75, 100, 'original'].forEach((size) => {
      const btn = document.createElement('button');
      btn.dataset.size = String(size);
      btn.textContent = size === 'original' ? 'Original' : `${size}%`;
      resizeBar.appendChild(btn);
    });
    const divider = document.createElement('span');
    divider.className = 'resize-bar-divider';
    resizeBar.appendChild(divider);
    const count = document.createElement('span');
    count.className = 'resize-bar-count';
    resizeBar.appendChild(count);
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
