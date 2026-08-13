# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with native PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Bookmarks panel** — Left-side outline panel built from article headings (H1-H6), with click-to-scroll and active heading tracking
- **Dark mode** — Full dark theme (neutral grays, VS Code Dark+ syntax highlighting). Auto-detects system preference.
- **Reading progress** — Thin gradient bar at the top tracks scroll position
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored left borders (Python, C++, Rust, JS, etc.)
- **Native PDF export** — Generates real PDFs via Chrome's printing engine with selectable text, searchable content, preserved links, PDF bookmarks/outline, and optional Table of Contents page
- **Bundled fonts** — All 13 font families work offline (latin subset, ~500KB total)
- **Custom fonts** — Adjust body and code font family, size, and weight from the Appearance popover
- **Edit mode** — Toggle pencil icon (or Alt+E) to enable hover-to-delete and double-click-to-edit. Alt+hover also works as a shortcut.
- **Grouped deletion** — Shift+click the delete button to remove all similar elements at once
- **Undo support** — Ctrl+Z to undo deletions, text edits, image resizes, and cleanup operations (up to 50 actions)
- **Image resize** — Click any image to select it, then resize to 25%, 50%, 75%, or 100% width. Ctrl+click to select multiple images
- **Noise cleanup** — Sparkles button strips common platform noise (e.g., "click to fullsize", "tap to view", "image by author")
- **Keyboard shortcuts** — Alt+B (bookmarks), Alt+D (dark mode), Alt+F (fonts), Alt+E (edit mode), Esc (close panels)
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

1. Download `ZenReader v1.4.0.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader toolbar icon
3. The article opens in a clean reader view
4. Use the floating right toolbar:

| Action | How |
|--------|-----|
| Toggle bookmarks | 🔖 Bookmark icon or `Alt+B` |
| Adjust fonts | 🔤 Font icon or `Alt+F` |
| Dark mode | 🌙 Moon icon or `Alt+D` |
| Edit mode | ✏️ Pencil icon or `Alt+E` — enables delete/edit |
| View tips | 💡 Lightbulb icon |
| Clean up noise | ✨ Sparkles icon |
| Delete element | Edit mode ON → hover + click ❌ (or Alt+hover) |
| Delete all similar | Shift+click the ❌ red X |
| Edit text | Edit mode ON → double-click paragraph (or Alt+dblclick) |
| Resize images | Click image to select, use resize bar (Ctrl+click for multi) |
| Undo | ⌨️ Ctrl+Z |
| Export PDF | 📄 PDF icon → configure margins/page size/TOC → generate |
| Print | 🖨️ Printer icon → browser print dialog |
| Close panels | `Esc` |

Tips appear automatically on load (auto-dismiss after 7 seconds).

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
- **Math rendering (MathJax/KaTeX) not supported.** Articles with LaTeX math notation show raw math source rather than rendered equations.
- **Debugger notification.** Chrome shows a brief "started debugging this browser" bar during PDF generation. This cannot be suppressed by extensions.

## Project Structure

```
zen-reader/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker + PDF generation via chrome.debugger
├── content.js             # Article extraction (injected into pages)
├── popup.html / popup.js  # Extension popup
├── reader.html / reader.js # Reader view + bookmarks + PDF export
├── css/
│   ├── fonts.css          # Bundled @font-face declarations
│   ├── reader.css         # All styling (banner, toolbar, bookmarks, dark mode, print)
│   └── highlight-vs.css   # VS-style syntax theme
├── fonts/                 # Bundled woff2 fonts (13 families, latin subset)
├── lib/
│   ├── Readability.js     # Mozilla Readability
│   └── highlight.min.js   # highlight.js
└── icons/                 # Extension icons (16/48/128px)
```

## Building icons

If you need to regenerate icons from the source SVG:

```bash
npm install
node generate-icons.js
```

## Changelog

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
