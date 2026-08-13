// ZenReader — MathJax source grabber (MAIN world)
//
// WHY THIS EXISTS
// ---------------
// On pages that render math with MathJax (loaded `async`), by the time the user
// invokes ZenReader the original LaTeX text nodes (e.g. `$x^2$`, `$$...$$`) have
// already been REPLACED by MathJax's rendered output. With the common
// `tex-svg` output component the rendered <mjx-container> contains NO
// `<annotation encoding="application/x-tex">`, so the TeX source is not
// recoverable from the DOM alone.
//
// However, MathJax keeps every input's original source string in memory:
//   - v3: MathJax.startup.document.math  (a MathList of MathItem)
//         each MathItem has .math (TeX string), .display (bool),
//         and .typesetRoot / .start.node (the rendered DOM node).
//   - v2: MathJax.Hub.getAllJax()  (array of jax)
//         each jax has .originalText and .SourceElement().
//
// content.js runs in the ISOLATED world and CANNOT read the page's `window`
// (and therefore not `window.MathJax`). So this tiny script is injected into
// the MAIN world FIRST. It reads MathJax's in-memory source list and writes the
// TeX back onto the corresponding rendered DOM nodes as data attributes
// (`data-zen-tex`, `data-zen-display`). content.js (ISOLATED world) then reads
// those attributes off the shared DOM and reconstructs `$...$`/`$$...$$` text so
// KaTeX in the reader can typeset them.
//
// This runs synchronously and is best-effort: if MathJax isn't present or hasn't
// finished, it simply tags whatever is available. Pages with pre-rendered KaTeX
// or MathJax v3 annotations are handled by preprocessMath() in content.js as a
// fallback, so nothing here is required for those.
(function () {
  'use strict';

  try {
    var MJ = window.MathJax;
    if (!MJ) return;

    // ---- MathJax v3 ----
    // MathJax.startup.document.math is an iterable list of MathItem objects.
    if (MJ.startup && MJ.startup.document && MJ.startup.document.math) {
      try {
        var mathList = MJ.startup.document.math;
        var tagItem = function (item) {
          try {
            if (!item || typeof item.math !== 'string' || !item.math.trim()) return;

            // Locate the rendered node for this item. `typesetRoot` is the
            // <mjx-container> after typesetting. Fall back to the input node.
            var node =
              item.typesetRoot ||
              (item.start && item.start.node) ||
              null;

            // If start.node is a text node (not yet typeset), use its parent so
            // we can carry an attribute.
            if (node && node.nodeType === 3 /* TEXT_NODE */) {
              node = node.parentNode;
            }
            if (!node || node.nodeType !== 1 /* ELEMENT_NODE */) return;

            node.setAttribute('data-zen-tex', item.math);
            node.setAttribute('data-zen-display', item.display ? '1' : '0');
          } catch (e) { /* per-item best-effort */ }
        };

        // MathList exposes forEach in standard builds; fall back to for..of for
        // builds that only implement Symbol.iterator.
        if (typeof mathList.forEach === 'function') {
          mathList.forEach(tagItem);
        } else if (typeof mathList[Symbol.iterator] === 'function') {
          for (var it of mathList) tagItem(it);
        }
      } catch (e) { /* v3 list unavailable in this build */ }
    }

    // ---- MathJax v2 ----
    // MathJax.Hub.getAllJax() returns an array of jax with originalText.
    if (MJ.Hub && typeof MJ.Hub.getAllJax === 'function') {
      try {
        var jaxes = MJ.Hub.getAllJax();
        for (var i = 0; i < jaxes.length; i++) {
          try {
            var jax = jaxes[i];
            if (!jax || !jax.originalText || !jax.originalText.trim()) continue;

            // The <script type="math/tex"> source element; the rendered output
            // is its next element sibling (span.MathJax / .MathJax_Display).
            var srcEl = typeof jax.SourceElement === 'function'
              ? jax.SourceElement()
              : null;
            if (!srcEl) continue;

            // Display mode is authoritatively signalled by the script's type
            // ("math/tex; mode=display"). Some builds also expose it on the jax
            // root via Get('displaystyle'); use it only as a secondary signal.
            var displayByType = /mode\s*=\s*display/.test(srcEl.getAttribute('type') || '');
            var displayByRoot = !!(jax.root && jax.root.Get && jax.root.Get('displaystyle') === true);
            var isDisplay = displayByType || displayByRoot;

            var rendered = srcEl.previousElementSibling || srcEl.nextElementSibling || srcEl;

            var target = (rendered && rendered.nodeType === 1) ? rendered : srcEl;
            target.setAttribute('data-zen-tex', jax.originalText);
            target.setAttribute('data-zen-display', isDisplay ? '1' : '0');
          } catch (e) { /* per-jax best-effort */ }
        }
      } catch (e) { /* v2 hub unavailable */ }
    }
  } catch (e) {
    // Never throw into the page.
  }
})();
