// ZenReader - Tips/Hints module
// Shows edit-mode tips when edit mode is first activated or via Alt+T.
// Centered on screen, with close button and bullet-point list.
'use strict';

const btnTips = document.getElementById('btn-tips');

const HINTS = [
  'Double-click text to edit',
  'Hover + red X to delete',
  'Shift+click X removes all similar',
  'Click image to resize (Ctrl for multi)',
  'Ignore "debugging started" in PDF export',
];

let hintsAutoDismiss = null;
let hasShownOnEditActivation = false;

export function showHintCards(autoDismiss = false) {
  // Toggle off if already open
  const existing = document.querySelector('.zen-tips');
  if (existing) {
    dismissTips(existing);
    return;
  }

  const container = document.createElement('div');
  container.className = 'zen-tips';

  // Header row: lightbulb + title + close button
  const header = document.createElement('div');
  header.className = 'zen-tips-header';
  header.innerHTML = `<span class="zen-tips-bulb">\u{1F4A1}</span><span class="zen-tips-title">Edit Mode Tips</span>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'zen-tips-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', () => dismissTips(container));
  header.appendChild(closeBtn);
  container.appendChild(header);

  // First tip (always visible as bullet)
  const tipsList = document.createElement('ul');
  tipsList.className = 'zen-tips-list';

  const firstItem = document.createElement('li');
  firstItem.className = 'zen-tips-item';
  firstItem.textContent = HINTS[0];
  tipsList.appendChild(firstItem);
  container.appendChild(tipsList);

  // "more" link that expands remaining tips
  const moreLink = document.createElement('a');
  moreLink.className = 'zen-tips-more';
  moreLink.textContent = 'more';
  moreLink.href = '#';
  moreLink.addEventListener('click', (e) => {
    e.preventDefault();
    moreLink.remove();
    for (let i = 1; i < HINTS.length; i++) {
      const item = document.createElement('li');
      item.className = 'zen-tips-item zen-tips-item-reveal';
      item.style.animationDelay = ((i - 1) * 60) + 'ms';
      item.textContent = HINTS[i];
      tipsList.appendChild(item);
    }
  });
  container.appendChild(moreLink);

  // Shortcut hint at bottom
  const footer = document.createElement('div');
  footer.className = 'zen-tips-footer';
  footer.textContent = 'Alt+T to toggle tips';
  container.appendChild(footer);

  document.body.appendChild(container);

  // CSS handles centering — just trigger the visible class
  requestAnimationFrame(() => container.classList.add('visible'));

  if (autoDismiss) {
    hintsAutoDismiss = setTimeout(() => {
      if (document.body.contains(container) && !container.classList.contains('zen-tips-dismiss')) {
        dismissTips(container);
      }
    }, 7000);
  }

  // Cancel auto-dismiss on interaction
  container.addEventListener('mouseenter', () => {
    clearTimeout(hintsAutoDismiss);
  });
}

function dismissTips(container) {
  clearTimeout(hintsAutoDismiss);
  container.classList.add('zen-tips-dismiss');
  container.addEventListener('animationend', () => container.remove(), { once: true });
}

/**
 * Called when edit mode is activated. Shows tips the first time only.
 */
export function onEditModeActivated() {
  if (!hasShownOnEditActivation) {
    hasShownOnEditActivation = true;
    showHintCards(true);
  }
}

// Legacy export (no longer needed, kept for API compat)
export function positionHintsCard() {}

// Tips button (manual toggle via toolbar or Alt+T)
btnTips.addEventListener('click', () => {
  showHintCards();
});
