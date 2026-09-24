// Content script: extracts article from current page using Readability.js
(async function() {
  'use strict';

  // Clone the document to avoid modifying the live page
  const docClone = document.cloneNode(true);

  // Inline live medium media iframe contents (same-origin) so clone has gist HTML
  try {
    const liveIframes = document.querySelectorAll('iframe[src*="medium.com/media"]');
    const cloneIframes = docClone.querySelectorAll('iframe[src*="medium.com/media"]');
    liveIframes.forEach((liveFrame, idx) => {
      const cloneFrame = cloneIframes[idx];
      if (!cloneFrame) return;
      try {
        const innerDoc = liveFrame.contentDocument;
        if (innerDoc && innerDoc.body && innerDoc.body.innerHTML.includes('blob-code')) {
          const parserLive = new DOMParser();
          const parsed = parserLive.parseFromString(innerDoc.body.innerHTML, 'text/html');
          const wrapper = docClone.createElement('div');
          while (parsed.body.firstChild) wrapper.appendChild(docClone.adoptNode(parsed.body.firstChild));
          cloneFrame.replaceWith(wrapper);
        }
      } catch (_) { /* cross-origin, fallback to fetch handler */ }
    });
  } catch (_) {}

  // ===== Pre-process: generic structural normalization (images/code/paywall) =====
  await preprocessGeneric(docClone);

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
      return el.outerHTML;
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
  async function preprocessGeneric(doc) {
    const scope = doc.body;
    if (!scope) return;

    // --- Remove paywall / subscription overlays (attribute-based, generic) ---
    scope.querySelectorAll(
      '[data-testid*="paywall" i], [data-component-name*="paywall" i], ' +
      '[class*="paywall" i], [id*="paywall" i], [aria-label*="paywall" i]'
    ).forEach((el) => el.remove());

    // --- Medium Gist embeds: fetch and inline gist content ---
    // Medium embeds gists via <script src="https://gist.github.com/user/gist-id.js"></script>
    // We replace these with the actual gist code before Readability runs.
    const gistScripts = Array.from(scope.querySelectorAll('script[src*="gist.github.com"]'));
    // Fetch all gists in parallel, then process
    await Promise.all(gistScripts.map(async (script) => {
      const src = script.getAttribute('src');
      if (!src) return;
      try {
        const resp = await fetch(src, { credentials: 'omit' });
        if (!resp.ok) return;
        const jsText = await resp.text();
        const writeMatches = jsText.match(/document\.write\(['"]([^'"]+)['"]\)/g);
        if (!writeMatches) return;
        let html = writeMatches.map(m => m.replace(/^document\.write\(['"]/, '').replace(/['"]\)$/, '')).join('');
        html = html.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const parser = new DOMParser();
        const gistDoc = parser.parseFromString(html, 'text/html');
        // Use DOMParser instead of innerHTML
        const wrapper = parser.parseFromString(gistDoc.body.innerHTML, 'text/html');
        wrapper.body.querySelectorAll('.gist-file, .gist-syntax, .blob-code').forEach((el) => {
          const text = el.textContent.trim();
          if (!text) return;
          const pre = doc.createElement('pre');
          const code = doc.createElement('code');
          code.textContent = text;
          pre.appendChild(code);
          el.replaceWith(pre);
        });
        // Move converted nodes to docClone
        while (wrapper.body.firstChild) {
          script.parentNode.insertBefore(wrapper.body.firstChild, script);
        }
        script.remove();
      } catch (e) {
        console.warn('ZenReader: failed to fetch gist', src, e);
      }
    }));

    // --- Medium media iframes: <iframe src="https://medium.com/media/..."> (gist wrapper) ---
    const mediaIframes = Array.from(scope.querySelectorAll('iframe[src*="medium.com/media"]'));
    await Promise.all(mediaIframes.map(async (iframe) => {
      const src = iframe.getAttribute('src');
      if (!src) return;
      try {
        const resp = await fetch(src, { credentials: 'omit' });
        if (!resp.ok) return;
        const html = await resp.text();
        const parser2 = new DOMParser();
        const mediaDoc = parser2.parseFromString(html, 'text/html');
        const gistScript = mediaDoc.querySelector('script[src*="gist.github.com"]');
        let gistHtml = '';
        if (gistScript) {
          const gsrc = gistScript.getAttribute('src');
          const gresp = await fetch(gsrc, { credentials: 'omit' });
          if (gresp.ok) {
            const jsText = await gresp.text();
            const m = jsText.match(/document\.write\(['"]([^'"]+)['"]\)/g);
            if (m) {
              gistHtml = m.map(x => x.replace(/^document\.write\(['"]/, '').replace(/['"]\)$/, '')).join('');
              gistHtml = gistHtml.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
            }
          }
        } else {
          const blobs = mediaDoc.querySelectorAll('.blob-code');
          if (blobs.length) gistHtml = Array.from(blobs).map(b => b.textContent).join('\n');
          else {
            const pre = mediaDoc.querySelector('pre');
            if (pre) gistHtml = pre.textContent;
          }
        }
        if (!gistHtml.trim()) return;
        const gistFragDoc = parser2.parseFromString(gistHtml, 'text/html');
        const pre = doc.createElement('pre');
        const code = doc.createElement('code');
        const meta = mediaDoc.querySelector('.gist-meta');
        if (meta) {
          const mm = meta.textContent.match(/\.(py|js|java|cpp|c|rb|go|rs|ts|sh|bash|json|yaml|html|css)/i);
          if (mm) code.className = 'language-' + mm[1].toLowerCase();
        } else if (/^\s*(def |import |from |class )/.test(gistHtml)) {
          code.className = 'language-python';
        }
        code.textContent = gistFragDoc.body.textContent.trim() || gistHtml.trim();
        pre.appendChild(code);
        iframe.replaceWith(pre);
      } catch (e) {
        console.warn('ZenReader: failed to fetch medium media iframe', src, e);
      }
    }));

    // --- Already-rendered gists (e.g. Medium after JS loads): <td class="blob-code"> ---
    // When clone is taken after Medium's JS, gist is already a <div class="gist"> table
    // Also handle bare tables with blob-code (Medium may wrap gist differently).
    const gistContainers = new Set(scope.querySelectorAll('.gist'));
    // Also catch any table/figure that contains blob-code but isn't inside .gist
    scope.querySelectorAll('.blob-code').forEach((cell) => {
      let container = cell.closest('.gist');
      if (!container) {
        // Find nearest table or wrapper that holds many blob-codes
        let t = cell.closest('table');
        if (t && t.querySelectorAll('.blob-code').length > 0) container = t;
        else container = cell.closest('figure') || cell.closest('div');
      }
      if (container) gistContainers.add(container);
    });
    gistContainers.forEach((gist) => {
      if (gist.querySelector('pre')) return;
      const lines = gist.querySelectorAll('.blob-code');
      if (lines.length === 0) return;
      const files = gist.querySelectorAll('.gist-file');
      const targets = files.length ? files : [gist];
      targets.forEach((fileEl) => {
        const fileLines = fileEl.querySelectorAll('.blob-code');
        const codeLines = fileLines.length ? fileLines : lines;
        if (codeLines.length === 0) return;
        const text = Array.from(codeLines).map((l) => l.textContent).join('\n').trim();
        if (!text) return;
        const pre = doc.createElement('pre');
        const code = doc.createElement('code');
        const meta = fileEl.querySelector('.gist-meta, [class*="file-info"]');
        if (meta) {
          const m = meta.textContent.match(/\.(py|js|java|cpp|c|rb|go|rs|ts|sh|bash|json|yaml|html|css)/i);
          if (m) code.className = 'language-' + m[1].toLowerCase();
        } else {
          // Detect python from def/import keywords
          if (/^\s*(def |import |from |class )/.test(text)) code.className = 'language-python';
        }
        code.textContent = text;
        pre.appendChild(code);
        if (fileEl !== gist) fileEl.replaceWith(pre);
        else gist.replaceWith(pre);
      });
    });

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
      const source = existingCode || pre;
      // Convert <br> to newlines (Medium uses <br> for line breaks in code)
      source.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
      const codeText = source.textContent;
      if (!codeText.trim()) return;

      const newPre = doc.createElement('pre');
      const newCode = doc.createElement('code');

      // Preserve class and data-* attributes from original <code> so
      // language identifiers (e.g. "language-bash") survive preprocessing.
      if (existingCode) {
        if (existingCode.className) newCode.className = existingCode.className;
        Array.from(existingCode.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-')) {
            newCode.setAttribute(attr.name, attr.value);
          }
        });
      }

      // If no language class yet, try to detect from sibling header (e.g. <div>bash</div> before <pre>)
      if (!newCode.className) {
        let lang = null;
        // Check previous sibling for language label
        let prev = pre.previousElementSibling;
        if (prev) {
          const text = prev.textContent.trim().toLowerCase();
          if (text && text.length < 20 && /^[a-z0-9+#-]+$/.test(text)) {
            lang = text;
          }
        }
        // Check parent's first child (header pattern)
        if (!lang && pre.parentElement) {
          const firstChild = pre.parentElement.firstElementChild;
          if (firstChild && firstChild !== pre) {
            const text = firstChild.textContent.trim().toLowerCase();
            if (text && text.length < 20 && /^[a-z0-9+#-]+$/.test(text)) {
              lang = text;
            }
          }
        }
        if (lang) newCode.className = 'language-' + lang;
      }

      newCode.textContent = codeText;
      newPre.appendChild(newCode);

      // Detect code-block wrapper pattern (e.g. jarvislabs.ai: outer <div> containing
      // header <div>bash</div> + copy button + <pre>). If found, replace the whole
      // wrapper so Readability doesn't prune it as a low-score container.
      let target = pre;
      let wrapper = null;
      let anc = pre.parentElement;
      for (let d = 0; d < 3 && anc; d++) {
        const fc = anc.firstElementChild;
        if (fc && fc !== pre) {
          const t = fc.textContent.trim().toLowerCase();
          if (t && t.length < 20 && /^[a-z0-9+#-]+$/.test(t) && anc.querySelector('pre') === pre) {
            wrapper = anc;
            break;
          }
        }
        // Also check previous sibling chain inside same parent
        anc = anc.parentElement;
      }
      if (wrapper) {
        target = wrapper;
      } else {
        // Climb past ancestor <div>s that wrap ONLY this pre (single element child),
        // so the clean <pre> replaces the whole wrapper subtree. Stop as soon as a
        // wrapper holds other content, to avoid deleting sibling material.
        let ancestor = pre.parentElement;
        for (let i = 0; i < 6 && ancestor; i++) {
          if (ancestor.tagName === 'DIV' && ancestor.children.length === 1) {
            target = ancestor;
            ancestor = ancestor.parentElement;
          } else {
            break;
          }
        }
      }
      if (target.parentNode) target.parentNode.replaceChild(newPre, target);
    });

    // --- Code: hoist code blocks from generic containers (catches non-<pre> code) ---
    // Some sites (e.g. jarvislabs.ai) wrap code in <div class="code-block"> or similar
    // without <pre>/<code>. Readability may prune these as "unlikely candidates".
    // Convert them early so they survive extraction.
    const codeContainerSelectors = [
      '[class*="code-block"]',
      '[class*="code_block"]',
      '[class*="codeblock"]',
      '[class*="highlight"]',
      '[class*="syntax"]',
      '[class*="snippet"]',
      'div[class*="language-"]',
      '[data-language]',
      '[data-lang]',
      'pre:not(:has(code))', // bare <pre> without <code>
    ];
    const seen = new Set();
    codeContainerSelectors.forEach((sel) => {
      scope.querySelectorAll(sel).forEach((container) => {
        if (seen.has(container)) return;
        // Skip if already has <pre> descendant (handled above)
        if (container.querySelector('pre')) return;
        // Skip if it's a large container with mixed content (likely not a pure code block)
        const text = container.textContent || '';
        if (text.length > 5000) return; // probably a whole article section
        // Convert to <pre><code>
        container.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
        const codeText = text.trim();
        if (!codeText) return;
        const newPre = doc.createElement('pre');
        const newCode = doc.createElement('code');
        // Try to extract language from class
        const langMatch = (container.className || '').match(/language-(\w+)/);
        if (langMatch) newCode.className = 'language-' + langMatch[1];
        newCode.textContent = codeText;
        newPre.appendChild(newCode);
        seen.add(container);
        // Replace the container (or its single-child wrapper chain)
        let target = container;
        let ancestor = container.parentElement;
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
        if (cm.className) newCode.className = cm.className;
        Array.from(cm.attributes).forEach((attr) => {
          if (attr.name.startsWith('data-')) {
            newCode.setAttribute(attr.name, attr.value);
          }
        });
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
          // Convert <br> to newlines
          pre.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
          const code = doc.createElement('code');
          const parentDiv = pre.parentElement;
          if (pre.className) code.className = pre.className;
          else if (parentDiv && parentDiv.className) code.className = parentDiv.className;
          Array.from(pre.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-')) {
              code.setAttribute(attr.name, attr.value);
            }
          });
          if (parentDiv) {
            Array.from(parentDiv.attributes).forEach((attr) => {
              if (attr.name.startsWith('data-')) {
                code.setAttribute(attr.name, attr.value);
              }
            });
          }
          while (pre.firstChild) code.appendChild(pre.firstChild);
          pre.replaceChildren(code);
        }
      });

// --- Generic: any <pre> that lacks a <code> child ---
      const nakedPres = doc.querySelectorAll('pre');
      nakedPres.forEach((pre) => {
        if (!pre.querySelector('code') && pre.textContent.trim().length > 0) {
          // Convert <br> to newlines
          pre.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
          const code = doc.createElement('code');
          if (pre.className) code.className = pre.className;
          Array.from(pre.attributes).forEach((attr) => {
            if (attr.name.startsWith('data-')) {
              code.setAttribute(attr.name, attr.value);
            }
          });
          while (pre.firstChild) code.appendChild(pre.firstChild);
          pre.replaceChildren(code);
        }
      });
  }

  // (normalizeLangName was removed along with the GeeksforGeeks-specific handler
  //  that was its only caller; language normalization now happens in reader.js.)

  // ===== Resolve relative URLs to absolute =====
  function resolveRelativeUrls(html, baseUrl) {
    // Parse into a temporary DOM element using DOMParser (avoids innerHTML)
    const parser = new DOMParser();
    const container = parser.parseFromString(html, 'text/html');
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

    return container.body.innerHTML;
  }

  function resolveUrl(url, base) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      return new URL(url, base.href).href;
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
