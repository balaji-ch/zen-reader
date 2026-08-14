// ZenReader - Core rendering module (article render, math, code, images, appearance)
'use strict';

import { articleData, setArticleData, showToast } from './state.js';
import { startCollapseTimer, appearancePopover, btnAppearance } from './toolbar.js';
import { buildBookmarks, showReadingStats } from './bookmarks.js';
import { makeDeletable, makeEditable, makeImagesResizable, setFocusMode } from './edit.js';


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

// ===== Dark Mode =====
const btnDarkMode = document.getElementById('btn-darkmode');

export function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark');
  btnDarkMode.classList.toggle('active', isDark);
  chrome.storage.sync.set({ darkMode: isDark });
}

btnDarkMode.addEventListener('click', toggleDarkMode);

chrome.storage.sync.get('darkMode', (result) => {
  let shouldBeDark = false;
  if (result.darkMode !== undefined) {
    shouldBeDark = result.darkMode;
  } else {
    shouldBeDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (shouldBeDark) {
    document.body.classList.add('dark');
    btnDarkMode.classList.add('active');
  }
});

// ===== Banner: fade after 10s =====
const banner = document.getElementById('banner');
const BANNER_FADE_DELAY = 10000;

setTimeout(() => {
  banner.classList.add('faded');
}, BANNER_FADE_DELAY);

// ===== Appearance Popover =====
btnAppearance.addEventListener('click', (e) => {
  e.stopPropagation();
  const isHidden = appearancePopover.classList.contains('hidden');
  if (isHidden) {
    appearancePopover.classList.remove('hidden');
    btnAppearance.classList.add('active');
    // Pause collapse while popover is open (imported from toolbar)
  } else {
    appearancePopover.classList.add('hidden');
    btnAppearance.classList.remove('active');
    startCollapseTimer();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.appearance-popover') && !e.target.closest('#btn-appearance')) {
    if (!appearancePopover.classList.contains('hidden')) {
      appearancePopover.classList.add('hidden');
      btnAppearance.classList.remove('active');
      startCollapseTimer();
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
  setArticleData(result.articleData);
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
  const data = articleData;
  document.title = data.title + ' - ZenReader';
  articleTitle.textContent = data.title;

  if (data.byline) {
    articleByline.textContent = data.byline;
  } else {
    articleByline.style.display = 'none';
  }

  if (data.url) {
    const domain = new URL(data.url).hostname;
    articleSource.innerHTML = `<a href="${data.url}" target="_blank">${domain}</a>`;
  }

  articleBody.innerHTML = data.content;

  renderMath();
  loadRemoteImages();
  constrainDecorativeImages();
  processCodeBlocks();
  makeDeletable();
  makeEditable();
  makeImagesResizable();
  buildBookmarks();
  showReadingStats();

  // Restore focus mode if it was on last time
  chrome.storage.sync.get('focusMode', (result) => {
    if (result && result.focusMode) {
      setFocusMode(true, { persist: false, announce: false });
    }
  });

  // Restore reading position for this URL
  restoreReadingPosition(data.url);
}

// ===== Render Math (KaTeX) =====
function renderMath() {
  if (typeof renderMathInElement === 'undefined') return;

  const text = articleBody.textContent;
  const hasLatex =
    /\$[^$]+\$/.test(text) ||
    /\\\([\s\S]+?\\\)/.test(text) ||
    /\\\[[\s\S]+?\\\]/.test(text) ||
    /\\begin\{/.test(text);
  if (!hasLatex) return;

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
function loadRemoteImages() {
  const images = articleBody.querySelectorAll('img');
  images.forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^https?:\/\//.test(src)) return;

    img.addEventListener('error', () => fetchAsBlob(img, src), { once: true });

    if (img.complete && img.naturalWidth === 0) {
      fetchAsBlob(img, src);
    }
  });
}

function fetchAsBlob(img, src) {
  if (img.dataset.blobLoaded === '1') return;
  chrome.runtime.sendMessage({ type: 'FETCH_IMAGE', url: src }, (resp) => {
    if (chrome.runtime.lastError) return;
    if (resp && resp.success && resp.dataUrl) {
      img.dataset.blobLoaded = '1';
      img.removeAttribute('srcset');
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

chrome.storage.sync.get('density', (result) => {
  applyDensity((result && result.density) || 'comfortable');
});

// ===== Custom CSS =====
const customCssInput = document.getElementById('custom-css-input');
let customStyleEl = document.createElement('style');
customStyleEl.id = 'custom-user-css';
document.head.appendChild(customStyleEl);

function applyCustomCss(css) {
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

  chrome.storage.sync.get('customCss', (result) => {
    if (result.customCss) {
      customCssInput.value = result.customCss;
      applyCustomCss(result.customCss);
    }
  });
}

// ===== Reading Position Persistence =====
// Saves scroll progress (as a fraction 0-1) per article URL so reopening the
// same article resumes where the user left off. Stored in chrome.storage.local
// under 'readingPositions' as { url: { progress, timestamp } }. Evicts entries
// older than 30 days to avoid unbounded growth.
// Disabled in incognito to honor private browsing.
const IS_INCOGNITO = chrome.extension.inIncognitoContext;
const POSITION_SAVE_DEBOUNCE = 1000; // ms
const POSITION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_POSITIONS = 200;
let positionSaveTimer = null;

function getScrollFraction() {
  const docHeight = document.documentElement.scrollHeight - window.innerHeight;
  if (docHeight <= 0) return 0;
  return Math.min(1, window.scrollY / docHeight);
}

function saveReadingPosition() {
  if (IS_INCOGNITO) return; // don't persist activity in private mode
  const data = articleData;
  if (!data || !data.url) return;

  const fraction = getScrollFraction();
  // Don't save if at the very top (nothing to resume) or fully scrolled
  // (article is "done" — don't force them back to the end).
  if (fraction < 0.01 || fraction > 0.99) return;

  chrome.storage.local.get('readingPositions', (result) => {
    const positions = result.readingPositions || {};
    positions[data.url] = { progress: fraction, timestamp: Date.now() };

    // Evict stale entries
    const now = Date.now();
    const urls = Object.keys(positions);
    for (const url of urls) {
      if (now - positions[url].timestamp > POSITION_MAX_AGE) {
        delete positions[url];
      }
    }

    // Cap total entries
    const remaining = Object.keys(positions);
    if (remaining.length > MAX_POSITIONS) {
      remaining
        .sort((a, b) => positions[a].timestamp - positions[b].timestamp)
        .slice(0, remaining.length - MAX_POSITIONS)
        .forEach(url => delete positions[url]);
    }

    chrome.storage.local.set({ readingPositions: positions });
  });
}

function restoreReadingPosition(url) {
  if (!url || IS_INCOGNITO) return;
  chrome.storage.local.get('readingPositions', (result) => {
    const positions = result.readingPositions || {};
    const saved = positions[url];
    if (!saved || typeof saved.progress !== 'number') return;
    if (saved.progress < 0.01) return;

    // Wait a tick for the DOM to finish layout after content injection
    requestAnimationFrame(() => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const targetY = Math.round(saved.progress * docHeight);
      window.scrollTo({ top: targetY, behavior: 'instant' });
      showToast(`Resumed at ${Math.round(saved.progress * 100)}%`);
    });
  });
}

// Debounced scroll listener for saving position
window.addEventListener('scroll', () => {
  clearTimeout(positionSaveTimer);
  positionSaveTimer = setTimeout(saveReadingPosition, POSITION_SAVE_DEBOUNCE);
});

// Also save on page unload (best-effort)
window.addEventListener('beforeunload', () => {
  saveReadingPosition();
});
