// ZenReader - srcset parsing helpers
//
// Shared by content.js (URL resolution before Readability) and the unit tests.
// Loaded as a plain script before content.js in the ISOLATED world, so it
// exposes `window.ZenSrcset`; in Node it exports the same API for tests.
//
// Why this exists: srcset URLs may legally contain commas (Substack,
// Cloudinary, Imgix, Shopify, ... all embed transform options in the path).
// Splitting the attribute on "," shreds those URLs. The parser below follows
// the HTML "parse a srcset attribute" algorithm: read the URL up to
// whitespace, then read descriptors up to the next comma.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ZenSrcset = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
  }

  // Returns [{ url, descriptors: [] }, ...] preserving the attribute order.
  function parseSrcset(srcset) {
    const candidates = [];
    const input = String(srcset || '');
    let i = 0;

    while (i < input.length) {
      // Skip whitespace and separating commas.
      while (i < input.length && (isWhitespace(input[i]) || input[i] === ',')) i++;
      if (i >= input.length) break;

      // A URL runs until whitespace. Commas are valid URL characters.
      const urlStart = i;
      while (i < input.length && !isWhitespace(input[i])) i++;
      let url = input.slice(urlStart, i);
      let descriptors = [];

      if (url.endsWith(',')) {
        // No descriptors: the comma terminates this candidate.
        url = url.replace(/,+$/, '');
      } else {
        // Descriptors run until the comma that starts the next candidate.
        const descStart = i;
        let j = i;
        while (j < input.length && input[j] !== ',') j++;
        descriptors = input.slice(descStart, j).trim().split(/\s+/).filter(Boolean);
        i = j + 1;
      }

      if (url) candidates.push({ url, descriptors });
    }

    return candidates;
  }

  function resolveOne(url, base) {
    if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url;
    try {
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  }

  // Resolve every candidate URL against `base`, then re-serialize.
  function resolveSrcset(srcset, base) {
    const baseUrl = base && base.href ? base.href : base;
    return parseSrcset(srcset)
      .map((candidate) => {
        const url = resolveOne(candidate.url, baseUrl);
        return candidate.descriptors.length
          ? url + ' ' + candidate.descriptors.join(' ')
          : url;
      })
      .join(', ');
  }

  // "Largest" = highest width descriptor, then highest density, then last.
  function candidateScore(candidate) {
    let score = 0;
    candidate.descriptors.forEach((descriptor) => {
      if (/^[\d.]+w$/.test(descriptor)) {
        score = Math.max(score, parseFloat(descriptor));
      } else if (/^[\d.]+x$/.test(descriptor)) {
        score = Math.max(score, parseFloat(descriptor) * 1000);
      }
    });
    return score;
  }

  function pickLargestFromSrcset(srcset) {
    let best = null;
    let bestScore = -1;
    parseSrcset(srcset).forEach((candidate) => {
      const score = candidateScore(candidate);
      if (score >= bestScore) {
        bestScore = score;
        best = candidate.url;
      }
    });
    return best;
  }

  return { parseSrcset, resolveSrcset, pickLargestFromSrcset };
});
