// ZenReader - Shared state and utilities
'use strict';

// ===== State =====
export let articleData = null;

export function setArticleData(data) {
  articleData = data;
}

// ===== Undo stack =====
const undoStack = [];
const MAX_UNDO = 50;

export function pushUndo(action) {
  undoStack.push(action);
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

export function performUndo() {
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

// ===== Toast notification =====
export function showToast(message, duration = 2500) {
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
