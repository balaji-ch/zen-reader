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

## Rebrand (deferred)

**Status: not started (decided 2026-11-15).** Ship 3.0.4 as-is; treat any rename
as its own minor release (e.g. 3.1.0), not a patch.

Leading candidate: **RaptReader** — simple, non-bookish, keeps the `-Reader`
suffix so the function is obvious in listing titles. It is a stronger brand than
the alternatives but has *not* been collision-checked yet.

Alternatives that came back clean in the Chrome Web Store index:

- **Zendo** — keeps the Zen lineage; pairs with `ZendoFx` on AMO under the same
  GUID.
- **Rapt** — four letters, one syllable, means "deeply absorbed"; pure brand.
- **One Column** / **BareRead** — literal and free, but read as feature
  descriptions rather than names.

Rejected:

- `Octavo`, `Ligature`, `Readsmith` — too bookish.
- `Delve` — the canonical LLM cliché; extensions already exist to flag the word.
- Already taken in-category: `Just Read`, `Plainpage`, `QuietPage`, `CleanPage`,
  `ReadEasy`, `Read View`, `Read This`, `Text Only`/`Text Mode`, `JustContent`,
  `Trim`, `Sift`, `Prune`, `Unfold`, `Lull`, `Samepage`, `Peruse`, `Lucent`
  (`Lucent Reader` is a direct conflict), `Marginalia`, `Dwell`, `Kivo`,
  `Serein`.
- Study-app framing (`Intellect`, `Cognify`, `Erudite`, `Cerebro`, `Lexicon`) —
  wrong positioning; this is a reader, not a highlighting/flashcard tool.

Name-collision note: the Chrome Web Store listing named "ZenReader"
(`nmcailccifjhlckggldjfdbplcbealjp`) belongs to a different developer (Nelson,
v2.0.0). Our extension is not published on the Chrome Web Store; the Firefox
add-on is (`ZenReaderFx`, GUID `zen-reader@balaji-ch.dev`).

### Checklist before renaming

- [ ] Confirm exact-name availability: Chrome Web Store search, AMO search,
      GitHub org/user handle, npm, domain, and a USPTO/EUIPO trademark scan.
- [ ] Pick the release version (e.g. 3.1.0) and note it in the release notes.

### Checklist for the rename itself

- [ ] `manifest.json` (`name`, `short_name`, `description`).
- [ ] `package.json` (`name`, `version`, `pack` zip filename).
- [ ] Popup title and all UI strings.
- [ ] Reader title suffix / history entry strings.
- [ ] `README.md` (title, install instructions, zip filename).
- [ ] Store listing text and screenshots.
- [ ] Firefox: rename only the *display name*, keep GUID
      `zen-reader@balaji-ch.dev` so existing users keep updating.
- [ ] `npm run pack` and verify the zip contents/hash against the working tree.
