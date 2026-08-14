// ZenReader - Export module (PDF dialog, Markdown conversion, print)
'use strict';

import { articleData, showToast } from './state.js';

const articleBody = document.getElementById('article-body');
const btnPrint = document.getElementById('btn-print');
const btnPdf = document.getElementById('btn-pdf');
const btnMarkdown = document.getElementById('btn-markdown');

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

  const wasDark = document.body.classList.contains('dark');
  if (wasDark) document.body.classList.remove('dark');

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
    if (tocElement) tocElement.remove();
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

  const contentsHeading = document.createElement('h2');
  contentsHeading.className = 'pdf-toc-heading';
  contentsHeading.textContent = 'Contents';
  toc.appendChild(contentsHeading);

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
    dotsSpan.textContent = '\u00B7'.repeat(200);

    li.appendChild(textSpan);
    li.appendChild(dotsSpan);
    list.appendChild(li);
  });

  toc.appendChild(list);

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

// ===== Export as Markdown =====
btnMarkdown.addEventListener('click', () => {
  const markdown = htmlToMarkdown(articleBody);
  const title = articleData ? articleData.title : 'Article';
  const header = `# ${title}\n\n`;
  const meta = articleData && articleData.url ? `> Source: ${articleData.url}\n\n` : '';
  const fullMd = header + meta + markdown;

  const blob = new Blob([fullMd], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(title) + '.md';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Markdown exported');
});

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\-_ ]/gi, '').substring(0, 100).trim() || 'article';
}

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
      case 'blockquote': {
        const bqLines = node.textContent.trim().split('\n');
        md += bqLines.map(l => '> ' + l).join('\n') + '\n\n'; break;
      }
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

function preToMarkdown(pre, wrapper) {
  const code = pre.querySelector('code');
  const source = code || pre;
  let text = extractCodeText(source);
  text = text.replace(/^\n+/, '').replace(/[ \t\n]+$/, '');

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

function extractCodeText(source) {
  const raw = source.textContent || '';
  if (raw.indexOf('\n') !== -1) return raw;

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
        const isLine = child.parentNode === source && BLOCK_TAGS.has(tag);
        walk(child);
        if (isLine && !out.endsWith('\n')) out += '\n';
      }
    });
  };
  walk(source);

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
