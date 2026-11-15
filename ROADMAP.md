# ZenReader roadmap

Deferred / cross-browser work that we want to remember. Shipped items belong in
the GitHub release notes, not here.

## Firefox port

**Status: postponed (as of 2026-11-15).** The blocker is bookmarks: the Firefox
bookmarks API/behavior doesn't work the way we need, so the port isn't worth
starting until that's resolved. Nothing here is cancelled — just on hold.

The Chrome extension is the reference implementation. When we build or sync the
Firefox version, these Chrome-side fixes need to be ported and verified:

- [ ] **v3.0.3 — KaTeX plain-text misrendering** (`reader/core.js` pre/post
      render passes + `css/reader.css` inline-KaTeX guards). Certain Substack
      pages rendered ordinary sentences character-by-character.
- [ ] **v3.0.4 — srcset comma URLs** (`lib/srcset.js`, `content.js`
      `resolveRelativeUrls`, `reader/core.js` blob fallback). URLs with commas
      (Substack/Cloudinary/Imgix/Shopify) were shredded, breaking images,
      especially `<picture><source>` elements.
- [ ] Verify WebP `<picture>` / `<source>` extraction and the
      `FETCH_IMAGE` blob fallback behave the same on Firefox (referrer and
      host-permission behavior may differ).

## Deferred

- [ ] Add coverage for extraction itself (not just `lib/srcset.js`), e.g. a
      fixture-driven test that runs `content.js` with a DOM.
- [ ] CI to run `npm test` and build the release zip.
