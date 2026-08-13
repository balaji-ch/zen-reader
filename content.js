// Content script: extracts article from current page using Readability.js
(function() {
  'use strict';

  // Clone the document to avoid modifying the live page
  const docClone = document.cloneNode(true);

  // ===== Pre-process: normalize site-specific code blocks =====
  preprocessCodeBlocks(docClone);

  // Run Readability on the cloned document
  const reader = new Readability(docClone, {
    // Keep classes on code blocks so we can detect language
    keepClasses: true,
    // Preserve data attributes for code language detection
    serializer: function(el) {
      return el.innerHTML;
    }
  });

  const article = reader.parse();

  if (!article) {
    alert('ZenReader: Could not extract article content from this page.');
    return;
  }

  // Resolve relative URLs in extracted content to absolute
  const resolvedContent = resolveRelativeUrls(article.content, window.location.href);

  // Also grab the page URL and any metadata
  const data = {
    title: article.title || document.title,
    byline: article.byline || '',
    content: resolvedContent,
    siteName: article.siteName || '',
    url: window.location.href,
    excerpt: article.excerpt || '',
    length: article.length,
    dir: article.dir || 'ltr'
  };

  // Send to background script
  chrome.runtime.sendMessage({
    type: 'ARTICLE_EXTRACTED',
    data: data
  });

  // ===== Code block pre-processing for various sites =====
  function preprocessCodeBlocks(doc) {
    // --- GeeksForGeeks: <gfg-tabs> → <pre><code> ---
    const gfgTabs = doc.querySelectorAll('gfg-tabs');
    gfgTabs.forEach((tabsEl) => {
      const panels = tabsEl.querySelectorAll('gfg-panel');
      const container = doc.createElement('div');
      container.className = 'reader-print-code-group';

      panels.forEach((panel) => {
        const lang = panel.getAttribute('data-code-lang') || '';
        const codeEl = panel.querySelector('code');
        const preEl = panel.querySelector('pre');

        // Get the text content (strip existing highlight spans to re-highlight later)
        let codeText = '';
        if (preEl) {
          codeText = preEl.textContent;
        } else if (codeEl) {
          codeText = codeEl.textContent;
        }

        if (codeText.trim()) {
          const newPre = doc.createElement('pre');
          const newCode = doc.createElement('code');
          // Normalize language name
          const normalizedLang = normalizeLangName(lang);
          newCode.className = 'language-' + normalizedLang;
          newCode.textContent = codeText;
          newPre.appendChild(newCode);
          container.appendChild(newPre);
        }
      });

      // Replace gfg-tabs with standard pre/code blocks
      if (container.children.length > 0) {
        tabsEl.parentNode.replaceChild(container, tabsEl);
      }
    });

    // --- GeeksForGeeks: <div class="code-output"> → <pre> with "output" label ---
    const gfgOutputs = doc.querySelectorAll('.code-output');
    gfgOutputs.forEach((outputEl) => {
      const preEl = outputEl.querySelector('pre');
      if (preEl) {
        const wrapper = doc.createElement('div');
        wrapper.className = 'reader-print-output';
        const label = doc.createElement('strong');
        label.textContent = 'Output';
        const newPre = doc.createElement('pre');
        const newCode = doc.createElement('code');
        newCode.className = 'language-text';
        newCode.textContent = preEl.textContent;
        newPre.appendChild(newCode);
        wrapper.appendChild(label);
        wrapper.appendChild(newPre);
        outputEl.parentNode.replaceChild(wrapper, outputEl);
      }
    });

    // --- Generic: CodeMirror (.CodeMirror) → <pre><code> ---
    const codeMirrors = doc.querySelectorAll('.CodeMirror');
    codeMirrors.forEach((cm) => {
      const lines = cm.querySelectorAll('.CodeMirror-line');
      if (lines.length > 0) {
        const text = Array.from(lines).map(l => l.textContent).join('\n');
        const newPre = doc.createElement('pre');
        const newCode = doc.createElement('code');
        newCode.textContent = text;
        newPre.appendChild(newCode);
        cm.parentNode.replaceChild(newPre, cm);
      }
    });

    // --- Generic: div.highlight > pre (GitHub, Pelican blogs, etc.) ---
    // These are usually fine but ensure they're not nested weirdly
    const highlightDivs = doc.querySelectorAll('div.highlight > pre');
    highlightDivs.forEach((pre) => {
      // If pre doesn't have a <code> child, wrap its content in one
      if (!pre.querySelector('code')) {
        const code = doc.createElement('code');
        code.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(code);
      }
    });

    // --- Medium / Substack / Generic: <pre> without <code> child ---
    const nakedPres = doc.querySelectorAll('pre');
    nakedPres.forEach((pre) => {
      if (!pre.querySelector('code') && pre.textContent.trim().length > 0) {
        const code = doc.createElement('code');
        code.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(code);
      }
    });
  }

  function normalizeLangName(lang) {
    const map = {
      'python3': 'python',
      'python2': 'python',
      'c_cpp': 'cpp',
      'c++': 'cpp',
      'cplusplus': 'cpp',
      'js': 'javascript',
      'ts': 'typescript',
      'sh': 'bash',
      'shell': 'bash',
      'console': 'bash',
      'zsh': 'bash',
      'yml': 'yaml',
      'htm': 'html',
      'objective-c': 'objectivec',
      'golang': 'go'
    };
    lang = (lang || '').toLowerCase().trim();
    return map[lang] || lang;
  }

  // ===== Resolve relative URLs to absolute =====
  function resolveRelativeUrls(html, baseUrl) {
    // Parse into a temporary DOM element
    const container = document.createElement('div');
    container.innerHTML = html;
    const base = new URL(baseUrl);

    // Resolve img src and srcset
    container.querySelectorAll('img').forEach((img) => {
      if (img.getAttribute('src')) {
        img.setAttribute('src', resolveUrl(img.getAttribute('src'), base));
      }
      if (img.getAttribute('srcset')) {
        img.setAttribute('srcset', resolveSrcset(img.getAttribute('srcset'), base));
      }
      // Handle data-src (lazy loading)
      if (img.getAttribute('data-src')) {
        img.setAttribute('src', resolveUrl(img.getAttribute('data-src'), base));
        img.removeAttribute('data-src');
      }
      // Remove loading=lazy since we want them to show immediately
      img.removeAttribute('loading');
    });

    // Resolve <source> srcset (for <picture> elements)
    container.querySelectorAll('source').forEach((source) => {
      if (source.getAttribute('srcset')) {
        source.setAttribute('srcset', resolveSrcset(source.getAttribute('srcset'), base));
      }
    });

    // Resolve <a> href
    container.querySelectorAll('a').forEach((a) => {
      if (a.getAttribute('href')) {
        a.setAttribute('href', resolveUrl(a.getAttribute('href'), base));
      }
    });

    // Resolve <video> and <audio> src
    container.querySelectorAll('video, audio, video source, audio source').forEach((el) => {
      if (el.getAttribute('src')) {
        el.setAttribute('src', resolveUrl(el.getAttribute('src'), base));
      }
    });

    return container.innerHTML;
  }

  function resolveUrl(url, base) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      return new URL(url, base.origin).href;
    } catch (e) {
      return url;
    }
  }

  function resolveSrcset(srcset, base) {
    return srcset.split(',').map((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (parts[0]) {
        parts[0] = resolveUrl(parts[0], base);
      }
      return parts.join(' ');
    }).join(', ');
  }

})();
