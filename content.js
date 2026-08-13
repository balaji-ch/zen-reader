// Content script: extracts article from current page using Readability.js
(function() {
  'use strict';

  // Clone the document to avoid modifying the live page
  const docClone = document.cloneNode(true);

  // ===== Pre-process: generic structural normalization (images/code/paywall) =====
  preprocessGeneric(docClone);

  // ===== Pre-process: restore LaTeX source from MathJax/KaTeX rendered output =====
  preprocessMath(docClone);

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

  // ===== Math pre-processing: restore LaTeX from rendered MathJax/KaTeX =====
  function preprocessMath(doc) {
    // --- Primary path: data-zen-tex attributes from math-grabber.js ---
    // The MAIN-world grabber (injected before this script) reads MathJax's
    // in-memory source list and stamps the original LaTeX onto each rendered
    // node as data-zen-tex (+ data-zen-display="1|0"). This is the ONLY reliable
    // source on tex-svg pages, where the rendered <mjx-container> carries no
    // TeX annotation. We handle it first and remove the rendered node so the
    // annotation/mjx-container passes below don't double-process it.
    const taggedNodes = doc.querySelectorAll('[data-zen-tex]');
    taggedNodes.forEach((node) => {
      const tex = (node.getAttribute('data-zen-tex') || '').trim();
      if (!tex) return;
      const isDisplay = node.getAttribute('data-zen-display') === '1';

      // MathJax v2 keeps the original source in a sibling
      // <script type="math/tex">. Remove it so the v2 script pass below doesn't
      // emit a duplicate of the same equation.
      [node.previousElementSibling, node.nextElementSibling].forEach((sib) => {
        if (sib && sib.tagName === 'SCRIPT' && (sib.type || '').startsWith('math/tex')) {
          sib.remove();
        }
      });

      const wrapper = doc.createElement('span');
      wrapper.textContent = isDisplay ? '$$' + tex + '$$' : '$' + tex + '$';
      wrapper.className = 'zen-math-source';
      if (node.parentNode) node.parentNode.replaceChild(wrapper, node);
    });

    // --- MathJax 3: <mjx-container> elements ---
    // MathJax 3 (tex-svg or tex-chtml) wraps output in <mjx-container>.
    // The original TeX source is stored in:
    //   1. An <annotation encoding="application/x-tex"> inside the SVG's <semantics>
    //   2. Or a preceding <script type="math/tex"> element
    const mjxContainers = doc.querySelectorAll('mjx-container');
    mjxContainers.forEach((container) => {
      const isDisplay = container.hasAttribute('display') ||
                        container.getAttribute('display') === 'true' ||
                        container.classList.contains('MathJax_Display');

      let tex = '';

      // Try annotation element first (MathJax SVG output)
      const annotation = container.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation) {
        tex = annotation.textContent.trim();
      }

      // Fallback: look for a preceding script tag
      if (!tex) {
        const prev = container.previousElementSibling;
        if (prev && prev.tagName === 'SCRIPT' && prev.type && prev.type.startsWith('math/tex')) {
          tex = prev.textContent.trim();
          prev.remove();
        }
      }

      if (tex) {
        const wrapper = doc.createElement('span');
        if (isDisplay) {
          wrapper.textContent = '$$' + tex + '$$';
        } else {
          wrapper.textContent = '$' + tex + '$';
        }
        wrapper.className = 'zen-math-source';
        container.parentNode.replaceChild(wrapper, container);
      }
    });

    // --- MathJax 2: <span class="MathJax"> or <span class="MathJax_Preview"> ---
    const mj2Scripts = doc.querySelectorAll('script[type="math/tex"], script[type="math/tex; mode=display"]');
    mj2Scripts.forEach((script) => {
      const isDisplay = (script.type || '').includes('mode=display');
      const tex = script.textContent.trim();
      if (tex) {
        const wrapper = doc.createElement('span');
        if (isDisplay) {
          wrapper.textContent = '$$' + tex + '$$';
        } else {
          wrapper.textContent = '$' + tex + '$';
        }
        wrapper.className = 'zen-math-source';
        script.parentNode.replaceChild(wrapper, script);
      }
    });

    // --- Remove MathJax rendered artifacts (previews, processed spans) ---
    doc.querySelectorAll('.MathJax, .MathJax_Preview, .MathJax_Display, .MathJax_SVG, .MathJax_SVG_Display, mjx-assistive-mml').forEach((el) => {
      // Only remove if we already replaced the source
      if (el.parentNode) el.remove();
    });

    // --- KaTeX: <span class="katex"> elements (from pre-rendered KaTeX) ---
    const katexEls = doc.querySelectorAll('.katex');
    katexEls.forEach((el) => {
      const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
      if (annotation) {
        const tex = annotation.textContent.trim();
        const isDisplay = el.closest('.katex-display') !== null;
        const wrapper = doc.createElement('span');
        if (isDisplay) {
          wrapper.textContent = '$$' + tex + '$$';
        } else {
          wrapper.textContent = '$' + tex + '$';
        }
        wrapper.className = 'zen-math-source';
        const target = el.closest('.katex-display') || el;
        target.parentNode.replaceChild(wrapper, target);
      }
    });

    // --- Clean up any leftover grabber attributes ---
    // Nodes whose TeX was empty (or that weren't replaced above) may still carry
    // data-zen-tex / data-zen-display. Strip them so they don't leak into the
    // reader/PDF/Markdown output.
    doc.querySelectorAll('[data-zen-tex], [data-zen-display]').forEach((el) => {
      el.removeAttribute('data-zen-tex');
      el.removeAttribute('data-zen-display');
    });
  }

  // ===== Generic structural normalizer =====
  // Many modern sites (SPA/React blogs, newsletter platforms, etc.) wrap
  // content in deeply-nested utility <div>s, put images inside <a> links, and
  // gate paid content behind an overlay. Readability scores these wrappers as
  // non-content and prunes them, so code/images can disappear. This normalizer
  // rewrites those structures into clean semantic HTML WITHOUT any site- or
  // hostname-specific rules — it keys purely off structural signals.
  function preprocessGeneric(doc) {
    const scope = doc.body;
    if (!scope) return;

    // --- Remove paywall / subscription overlays (attribute-based, generic) ---
    scope.querySelectorAll(
      '[data-testid*="paywall" i], [data-component-name*="paywall" i], ' +
      '[class*="paywall" i], [id*="paywall" i], [aria-label*="paywall" i]'
    ).forEach((el) => el.remove());

    // --- Clean heading widgets so real <hN> survive extraction ---
    // Reasoning (confirmed against Readability.js internals): Readability's very
    // first pass in _grabArticle removes "unlikely candidate" nodes whose
    // (className + " " + id) matches its UNLIKELY_CANDIDATES regex, which
    // includes the substring "header". Sites that put a class like
    // "header-anchor-post" on their <h2> therefore get the ENTIRE heading
    // deleted before scoring — so those headings vanish and bookmarks/TOC come
    // up empty (plain classless <h2> on other sites is unaffected).
    //
    // Fix: clear class/id on headings so their matchString is empty and the
    // unlikely-candidate filter can never fire. Also flatten any nested widget
    // (hover anchor links, buttons, svg icons) to plain text. Generic; no site
    // rules.
    scope.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
      const text = (h.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) return;
      h.removeAttribute('class'); // stop Readability's "header" unlikely-candidate match
      h.removeAttribute('id');
      if (h.children.length > 0) {
        h.textContent = text; // drop nested anchor/button/svg widgets
      }
    });

    // --- Promote "bold paragraph" pseudo-headings to real <h3> ---
    // Reasoning: some platforms (notably newsletter editors) render section
    // headings as a <p> containing only a <strong>/<b>, not a real <hN>. That
    // means the reader's heading-based features (bookmarks, PDF table of
    // contents) find nothing. Detect that structural pattern generically — a
    // short paragraph whose entire visible text is bold — and convert it to a
    // heading so those features work. Conservative checks avoid promoting
    // ordinary emphasised sentences.
    scope.querySelectorAll('p').forEach((p) => {
      const text = (p.textContent || '').trim();
      if (!text) return;
      if (text.length > 120) return;            // headings are short
      if (/[.!?:;]\s*$/.test(text)) return;     // sentences end in punctuation

      // The paragraph must consist essentially of a single bold run and nothing
      // else (ignoring whitespace/<br>).
      const meaningful = Array.from(p.childNodes).filter((n) => {
        if (n.nodeType === Node.TEXT_NODE) return n.textContent.trim().length > 0;
        if (n.nodeType === Node.ELEMENT_NODE) return n.tagName !== 'BR';
        return false;
      });
      if (meaningful.length !== 1) return;
      const only = meaningful[0];
      if (only.nodeType !== Node.ELEMENT_NODE) return;
      if (only.tagName !== 'STRONG' && only.tagName !== 'B') return;
      if ((only.textContent || '').trim() !== text) return; // bold covers all text

      const h = doc.createElement('h3');
      h.textContent = text;
      p.parentNode.replaceChild(h, p);
    });

    // --- Images: resolve real URL, then lift <img> out of wrapping <a> links ---
    scope.querySelectorAll('img').forEach((img) => {
      // Prefer an explicit original URL exposed via a data-* JSON blob or lazy attrs.
      const realSrc = getBestImageSrc(img);
      if (realSrc) img.setAttribute('src', realSrc);

      // If the image is the sole meaningful content of an <a> (common in
      // lightbox/zoom wrappers), unwrap the link so the image isn't pruned.
      const link = img.closest('a');
      if (link && link.parentNode) {
        const linkText = (link.textContent || '').trim();
        if (linkText.length === 0) { // link contains only the image (no caption text)
          link.parentNode.replaceChild(img, link);
        }
      }
    });

    // --- Code: hoist any <pre> out of single-child wrapper <div> chains ---
    // Rebuild as a clean <pre><code> preserving newlines, and replace the
    // outermost wrapper that contains ONLY this code block.
    scope.querySelectorAll('pre').forEach((pre) => {
      const existingCode = pre.querySelector('code');
      const codeText = (existingCode || pre).textContent;
      if (!codeText.trim()) return;

      const newPre = doc.createElement('pre');
      const newCode = doc.createElement('code');
      newCode.textContent = codeText;
      newPre.appendChild(newCode);

      // Climb past ancestor <div>s that wrap ONLY this pre (single element child),
      // so the clean <pre> replaces the whole wrapper subtree. Stop as soon as a
      // wrapper holds other content, to avoid deleting sibling material.
      let target = pre;
      let ancestor = pre.parentElement;
      for (let i = 0; i < 6 && ancestor; i++) {
        if (ancestor.tagName === 'DIV' && ancestor.children.length === 1) {
          target = ancestor;
          ancestor = ancestor.parentElement;
        } else {
          break;
        }
      }
      if (target.parentNode) target.parentNode.replaceChild(newPre, target);
    });
  }

  // Determine the best real image URL, generically.
  //
  // IMPORTANT ORDERING: a rendered <img>'s existing src is the MOST reliable URL,
  // because the browser already loaded it. Some platforms expose an "original"
  // URL in a data-* JSON blob that points at private/origin storage (e.g. an S3
  // bucket) which is NOT publicly served — using it yields broken images. So we
  // only fall back to data-*/lazy/srcset when the current src is missing or an
  // obvious placeholder. This keeps the logic generic (no site rules) while
  // preferring the URL that's known to work.
  function getBestImageSrc(img) {
    const current = img.getAttribute('src') || '';
    if (isUsableSrc(current)) return current; // keep the working, already-rendered URL

    // 1) Common lazy-load attributes
    const lazyAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-delayed-url', 'data-li-src'];
    for (const a of lazyAttrs) {
      const v = img.getAttribute(a);
      if (isUsableSrc(v)) return v;
    }
    // 2) Largest candidate in srcset
    const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset');
    if (srcset) {
      const best = pickLargestFromSrcset(srcset);
      if (isUsableSrc(best)) return best;
    }
    // 3) Last resort: a data-* JSON blob with {src}. May be an origin URL, but
    //    better than nothing when no usable src/srcset exists.
    for (const attr of img.getAttributeNames()) {
      if (!attr.startsWith('data-')) continue;
      const val = img.getAttribute(attr);
      if (val && val.charAt(0) === '{' && val.indexOf('"src"') !== -1) {
        try {
          const parsed = JSON.parse(val);
          if (parsed && typeof parsed.src === 'string' && parsed.src) return parsed.src;
        } catch (e) { /* not JSON, ignore */ }
      }
    }
    return null;
  }

  // A src is "usable" if it's a real http(s)/protocol-relative URL and not a
  // tiny inline placeholder (blank-pixel data URIs used for lazy loading).
  function isUsableSrc(src) {
    if (!src) return false;
    if (src.startsWith('data:image/svg')) return false;         // inline SVG placeholder
    if (/^data:image\/gif;base64,R0l/.test(src)) return false;  // 1x1 blank gif placeholder
    if (src.startsWith('data:')) return false;                  // other inline placeholders
    return /^https?:\/\//.test(src) || src.startsWith('//');
  }

  function pickLargestFromSrcset(srcset) {
    let bestUrl = null, bestW = -1;
    srcset.split(',').forEach((part) => {
      const seg = part.trim().split(/\s+/);
      const url = seg[0];
      const w = seg[1] && seg[1].endsWith('w') ? parseInt(seg[1]) : 0;
      if (url && w >= bestW) { bestW = w; bestUrl = url; }
    });
    return bestUrl;
  }

  function preprocessCodeBlocks(doc) {
    // NOTE: Site/vendor-specific handlers were intentionally removed to keep this
    // logic generic (no per-site rules). Previously there were GeeksforGeeks-only
    // blocks keyed off the proprietary <gfg-tabs>/<gfg-panel> custom elements and a
    // ".code-output" class. Those can't be generalized structurally (they rely on a
    // single site's markup), so they were dropped. The handlers that remain below
    // target widely-used, cross-site *frameworks* and structural patterns, so they
    // benefit many sites rather than one.

    // --- Generic: CodeMirror (.CodeMirror) → <pre><code> ---
    // Reasoning: CodeMirror is a popular embeddable code-editor library used by
    // many sites/docs. It renders each line as a separate .CodeMirror-line with no
    // real newlines, so we reconstruct the text. This is a framework convention,
    // not a single site's markup, so it stays.
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

    // --- Generic: div.highlight > pre ---
    // Reasoning: "div.highlight > pre" is the de-facto output structure of Pygments
    // and many static-site generators (Jekyll, Pelican, Hugo, MkDocs, GitHub, etc.).
    // It's a shared convention across countless sites, not one vendor, so it stays.
    // We only ensure the <pre> has a <code> child (some emit <pre> alone).
    const highlightDivs = doc.querySelectorAll('div.highlight > pre');
    highlightDivs.forEach((pre) => {
      if (!pre.querySelector('code')) {
        const code = doc.createElement('code');
        code.innerHTML = pre.innerHTML;
        pre.innerHTML = '';
        pre.appendChild(code);
      }
    });

    // --- Generic: any <pre> that lacks a <code> child ---
    // Reasoning: HTML/Markdown code blocks are conventionally <pre><code>, but many
    // editors/exporters emit a bare <pre>. Wrapping its contents in <code> gives the
    // reader's highlighter a consistent target. Purely structural; applies anywhere.
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

  // (normalizeLangName was removed along with the GeeksforGeeks-specific handler
  //  that was its only caller; language normalization now happens in reader.js.)

  // ===== Resolve relative URLs to absolute =====
  function resolveRelativeUrls(html, baseUrl) {
    // Parse into a temporary DOM element
    const container = document.createElement('div');
    container.innerHTML = html;
    const base = new URL(baseUrl);

    // Resolve img src and srcset (including lazy-loaded images)
    container.querySelectorAll('img').forEach((img) => {
      // Handle various lazy-load patterns
      const lazySrcAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-delayed-url', 'data-li-src'];
      for (const attr of lazySrcAttrs) {
        if (img.getAttribute(attr)) {
          img.setAttribute('src', resolveUrl(img.getAttribute(attr), base));
          img.removeAttribute(attr);
          break;
        }
      }

      // Handle lazy srcset variants
      const lazySrcsetAttrs = ['data-srcset', 'data-lazy-srcset'];
      for (const attr of lazySrcsetAttrs) {
        if (img.getAttribute(attr)) {
          img.setAttribute('srcset', resolveSrcset(img.getAttribute(attr), base));
          img.removeAttribute(attr);
          break;
        }
      }

      // Resolve existing src/srcset
      if (img.getAttribute('src')) {
        const src = img.getAttribute('src');
        // Skip placeholder data URIs / tiny base64 placeholders
        if (!src.startsWith('data:image/svg') && !src.startsWith('data:image/gif;base64,R0l')) {
          img.setAttribute('src', resolveUrl(src, base));
        }
      }
      if (img.getAttribute('srcset')) {
        img.setAttribute('srcset', resolveSrcset(img.getAttribute('srcset'), base));
      }

      // Remove loading=lazy and reveal hidden lazy images
      img.removeAttribute('loading');
      img.removeAttribute('decoding');
      if (img.classList.contains('lazyload') || img.classList.contains('lazy')) {
        img.classList.remove('lazyload', 'lazy');
        img.classList.add('lazyloaded');
      }

      // Generic hotlink/referrer fix: set no-referrer directly on the element.
      // Many image CDNs 404 requests that carry a cross-origin (here,
      // chrome-extension://) Referer, but serve the image for "no-referrer"
      // requests. Setting it per-image is more reliable for dynamically-inserted
      // images than relying solely on the page-level <meta name="referrer">.
      img.setAttribute('referrerpolicy', 'no-referrer');
      // Ensure a stale crossorigin attr doesn't force a CORS-gated request.
      img.removeAttribute('crossorigin');
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
