# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with native PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Bookmarks panel** — Left-side outline panel built from article headings (H1-H6), with click-to-scroll, active heading tracking, per-section read-progress indicators, and a Back-to-top button
- **Dark mode** — Full dark theme (neutral grays, VS Code Dark+ syntax highlighting). Auto-detects system preference.
- **Reading progress** — Thin gradient bar at the top tracks scroll position
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored left borders (Python, C++, Rust, JS, etc.)
- **Math rendering (KaTeX)** — LaTeX math from MathJax/KaTeX pages is recovered and typeset as real equations (inline `$…$` and display `$$…$$`), even on async MathJax pages where the source is normally lost
- **Native PDF export** — Generates real PDFs via Chrome's printing engine with selectable text, searchable content, preserved links, PDF bookmarks/outline, and optional Table of Contents page
- **Markdown export** — Save the cleaned article as a `.md` file, preserving headings, code fences (with language), lists, tables, and links
- **Focus mode** — Dims all but the block you're reading for a spotlight effect (Alt+O); remembered across reloads and never dims your PDF/print output
- **Layout density** — Compact / Comfortable / Spacious presets adjust line spacing and column width in one click (remembered across reloads)
- **Custom CSS** — Apply your own styles to the reader from the Appearance popover (remembered across reloads)
- **Reading stats** — Estimated read time + word count; live word count for any text you select
- **Bundled fonts** — All 13 font families work offline (latin subset, ~500KB total)
- **Custom fonts** — Adjust body and code font family, size, and weight from the Appearance popover
- **Movable, groupable toolbar** — Drag the toolbar anywhere by its grip handle (position remembered); minimize it into a gear button; buttons grouped View / Edit / Export
- **Movable tips card** — Drag the Tips card by its header to reposition it (position remembered)
- **Edit mode** — Toggle pencil icon (or Alt+E) to enable hover-to-delete and double-click-to-edit. Alt+hover also works as a shortcut.
- **Grouped deletion** — Shift+click the delete button to remove all similar elements at once
- **Undo support** — Ctrl+Z to undo deletions, text edits, and image resizes (up to 50 actions)
- **Image resize** — Click any image to select it, then resize to 25%, 50%, 75%, or 100% width. Ctrl+click to select multiple images
- **Keyboard shortcuts** — Alt+B (bookmarks), Alt+F (fonts), Alt+D (dark mode), Alt+T (tips), Alt+E (edit mode), Alt+O (focus mode), Alt+P (print), Alt+S (save PDF), Alt+M (markdown), Esc (close panels)
- **Smart page breaks** — Headings stay with their content; code blocks and images don't split across pages
- **Ligature-free code** — Code blocks disable font ligatures to correctly display tokens like `<|end_of_text|>`
- **Auto-collapsing UI** — Right toolbar and banner fade/collapse after 10s of inactivity, maximizing reading space
- **Responsive** — Bookmarks panel adapts to narrow viewports (<700px becomes overlay)

## Installation

### From source (developer mode)

1. Clone the repository:
   ```bash
   git clone https://github.com/balaji-ch/zen-reader.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top-right)

4. Click **Load unpacked** and select the cloned `zen-reader` folder

5. The ZenReader icon appears in your toolbar

### From release ZIP

1. Download `ZenReader v2.1.0.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader toolbar icon
3. The article opens in a clean reader view
4. Use the floating right toolbar:

The toolbar buttons are grouped **View** (bookmarks, fonts, dark mode, tips), **Edit** (edit mode, focus mode), and **Export** (print, PDF, markdown).

| Action | How |
|--------|-----|
| Toggle bookmarks | 🔖 Bookmark icon or `Alt+B` |
| Adjust fonts / density / custom CSS | 🔤 Font icon or `Alt+F` |
| Back to top | Bookmarks panel footer button |
| Dark mode | 🌙 Moon icon or `Alt+D` |
| View tips | 💡 Lightbulb icon or `Alt+T` |
| Edit mode | ✏️ Pencil icon or `Alt+E` — enables delete/edit |
| Focus mode | 👁️ Eye icon or `Alt+O` — dims surrounding content |
| Print | 🖨️ Printer icon or `Alt+P` |
| Export PDF | 📄 PDF icon or `Alt+S` → configure margins/page size/TOC → generate |
| Export Markdown | ⬇️ Markdown icon or `Alt+M` → downloads a `.md` file |
| Move toolbar | Drag the ⣿ grip handle at the top (position remembered) |
| Minimize toolbar | Click the − button in the handle row → collapses into the gear |
| Move tips card | Drag the Tips card by its header (position remembered) |
| Delete element | Edit mode ON → hover + click ❌ (or Alt+hover) |
| Delete all similar | Shift+click the ❌ red X |
| Edit text | Edit mode ON → double-click paragraph (or Alt+dblclick) |
| Resize images | Click image to select, use resize bar (Ctrl+click for multi) |
| Undo | ⌨️ Ctrl+Z |
| Close panels | `Esc` |

Tips appear automatically on load (auto-dismiss after 7 seconds). Opening them
via the 💡 button keeps them until you close them.

## PDF vs Print

ZenReader offers two ways to produce output. They serve different purposes:

| | **PDF** (document icon) | **Print** (printer icon) |
|--|-------------------------|--------------------------|
| **What it does** | Generates a downloadable `.pdf` file via Chrome's DevTools Protocol | Opens the browser's native print dialog |
| **Bookmarks/Outline** | Yes — heading structure (H1-H6) embedded as PDF bookmarks | No |
| **Tagged/Accessible** | Yes — produces a tagged PDF for screen readers | Depends on printer/driver |
| **Margins** | Configurable in-app (None / Minimal / Custom) | Configured in the print dialog |
| **Page size** | Selectable (A4, Letter, Legal) | Configured in the print dialog |
| **Output** | Always a PDF file saved to disk | Paper, or "Save as PDF" via the print dialog |
| **Use when** | You want a polished, bookmarked, accessible PDF document | You want a quick printout or prefer the native print flow |

> **Note:** During PDF generation, Chrome briefly shows a "debugging started" notification bar. This is expected — the extension temporarily attaches the Chrome Debugger to access the native PDF renderer.

## PDF Export Details

When you click the PDF icon, a dialog appears with:

| Setting | Description |
|---------|-------------|
| Margins | **No Margin** (0mm), **Minimal** (5mm all sides), or **Custom** (per-side control, 0-50mm) |
| Page size | A4, Letter, or Legal |

The generated PDF includes:

- Selectable and searchable text
- Preserved hyperlinks and images
- PDF bookmarks/outline built from article headings (H1-H6)
- Tagged PDF for accessibility
- Smart page breaks — headings kept with content, images don't split
- All edits, deletions, and image resizes reflected in the output

## Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access the current page to extract article content |
| `storage` | Persist font preferences, bookmarks panel state, and pass article data to the reader |
| `scripting` | Inject the Readability content script into pages |
| `debugger` | Attach to the reader tab to call Chrome's native `Page.printToPDF` |
| `downloads` | Save the generated PDF file to disk |

## Known Limitations

- **Cannot extract from restricted pages.** Chrome prevents content script injection on `chrome://`, `edge://`, `chrome-extension://`, Chrome Web Store pages, and `file://` URLs.
- **Math recovery depends on the source.** Math is recovered from MathJax's in-memory source and from KaTeX/MathJax annotations in the DOM. Pages that render math as images with no recoverable LaTeX source cannot be typeset.
- **Debugger notification.** Chrome shows a brief "started debugging this browser" bar during PDF generation. This cannot be suppressed by extensions.

## Project Structure

```
zen-reader/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker + PDF generation + image proxy
├── content.js             # Article extraction + math/code/image preprocessing
├── math-grabber.js        # MAIN-world script: recovers LaTeX from MathJax's store
├── popup.html / popup.js  # Extension popup (injects math-grabber then content.js)
├── reader.html / reader.js # Reader view + bookmarks + PDF/Markdown export
├── css/
│   ├── fonts.css          # Bundled @font-face declarations
│   ├── reader.css         # All styling (banner, toolbar, bookmarks, dark mode, print)
│   └── highlight-vs.css   # VS-style syntax theme
├── fonts/                 # Bundled woff2 fonts (13 families, latin subset)
├── lib/
│   ├── Readability.js     # Mozilla Readability
│   ├── highlight.min.js   # highlight.js
│   └── katex/             # KaTeX (js, css, fonts) for math typesetting
└── icons/                 # Extension icons (16/48/128px)
```

## Building icons

If you need to regenerate icons from the source SVG:

```bash
npm install
node generate-icons.js
```

## Changelog

### v2.1.0
- **Layout density presets** — Compact / Comfortable / Spacious (line spacing + column width), remembered across reloads
- **Bookmarks progress** — sections you've scrolled past get a read indicator; added a Back-to-top button in the panel footer
- **Focus mode persists** across reloads
- **Fix:** focus mode no longer dims PDF/print output — exports are always full-color regardless of focus state (custom CSS persistence was already in place)

### v2.0.0
Major release — adds math rendering, Markdown export, focus mode, custom CSS,
reading stats, and a movable/groupable toolbar.

- **Math rendering (KaTeX):** LaTeX math is recovered from MathJax's in-memory source (via a MAIN-world grabber) and from KaTeX/MathJax DOM annotations, then typeset with KaTeX — works even on async MathJax `tex-svg` pages where the source is otherwise lost
- **Markdown export:** save the cleaned article as `.md` (headings, code fences with language, lists, tables, links)
- **Focus mode (Alt+O):** dims all but the block you're reading
- **Custom CSS:** apply your own styles from the Appearance popover
- **Reading stats:** estimated read time + word count, plus live selection word count
- **Movable toolbar:** drag by the grip handle (position persisted); explicit minimize button collapses it into the gear with a bounce
- **Toolbar grouping:** buttons grouped View / Edit / Export with dividers
- **Movable tips card:** drag by its header (position persisted); auto-shown card fades after 7s, button-opened card stays until closed
- **More shortcuts:** Alt+T (tips), Alt+O (focus), Alt+P (print), Alt+S (save PDF), Alt+M (markdown)
- **Remote image fix:** referrer/hotlink-protected image CDNs load via a background-worker byte fetch
- **Extraction robustness:** generic paywall/overlay removal, lazy-image resolution, `<pre>` hoisting, and heading normalization (no site-specific rules)
- Removed the noise-cleanup (sparkles) button
- Fixed CSP `style-src` to allow inline styles (was silently aborting the reader)

### v1.4.0
- Dark mode with neutral gray theme and VS Code Dark+ syntax highlighting
- Auto-detects system `prefers-color-scheme` on first use
- Reading progress bar (thin gradient at top)
- All 13 font families bundled locally (~500KB woff2, full offline support)
- Google Fonts CDN made non-blocking (instant page load)
- PDF Table of Contents option (checkbox in PDF dialog)
- PDF and Print always export in light mode regardless of dark mode state
- Edit mode toggle (pencil icon) — hover-to-delete and double-click-to-edit only active in edit mode
- Alt+hover as shortcut to delete without entering edit mode
- Keyboard shortcuts: Alt+B, Alt+D, Alt+F, Alt+E, Esc (shown in tooltips)
- Responsive bookmarks panel (narrows <900px, overlay <700px)
- Toolbar collapse paused while Appearance popover is open

### v1.3.0
- Bookmarks panel: heading outline visible in reader (left sidebar, toggleable, persisted state)
- Redesigned UI: minimal banner + floating right toolbar that collapses to a gear icon after 10s
- Appearance popover: combined text/code font settings in one panel
- Tips repositioned below toolbar with smooth fade dismiss
- Re-extraction without page refresh (removed single-run guard)
- Scroll-margin-top on headings for proper bookmark navigation
- Monochrome icon toolbar (bookmark ribbon, font T, sparkles, lightbulb, printer, PDF)

### v1.2.0
- Native PDF export via Chrome DevTools Protocol with bookmarks and tagged output
- Custom margins (presets + custom) and page size selection
- Noise cleanup button
- Image resize with multi-select

### v1.1.0
- Initial release with article extraction, syntax highlighting, custom fonts, inline editing, element deletion

## License

ISC
