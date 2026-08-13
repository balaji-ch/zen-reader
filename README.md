# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with native PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Bookmarks panel** — Left-side outline panel built from article headings (H1-H6), with click-to-scroll and active heading tracking
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored left borders (Python, C++, Rust, JS, etc.)
- **Native PDF export** — Generates real PDFs via Chrome's printing engine with selectable text, searchable content, preserved links, PDF bookmarks/outline from headings, and tagged/accessible output
- **Custom fonts** — Adjust body and code font family, size, and weight from the Appearance popover
- **Inline text editing** — Double-click any paragraph or heading to edit text directly
- **Element removal** — Hover over any paragraph, image, or block to delete it with the red X button
- **Grouped deletion** — Shift+click the delete button to remove all similar elements at once
- **Undo support** — Ctrl+Z to undo deletions, text edits, image resizes, and cleanup operations (up to 50 actions)
- **Image resize** — Click any image to select it, then resize to 25%, 50%, 75%, or 100% width. Ctrl+click to select multiple images
- **Noise cleanup** — Sparkles button strips common platform noise (e.g., "click to fullsize", "tap to view", "image by author")
- **Smart page breaks** — Headings stay with their content; code blocks and images don't split across pages
- **Ligature-free code** — Code blocks disable font ligatures to correctly display tokens like `<|end_of_text|>`
- **Auto-collapsing UI** — Right toolbar and banner fade/collapse after 10s of inactivity, maximizing reading space

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

1. Download `ZenReader v1.3.0.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader toolbar icon
3. The article opens in a clean reader view
4. Use the floating right toolbar:

| Action | How |
|--------|-----|
| Toggle bookmarks | Click bookmark icon (ribbon) — left panel shows/hides |
| Adjust fonts | Click font icon (T) — Appearance popover opens |
| View tips | Click lightbulb icon |
| Clean up noise | Click sparkles icon |
| Resize images | Click image to select, use resize bar (Ctrl+click for multi-select) |
| Edit text | Double-click any paragraph or heading |
| Delete element | Hover and click the red X |
| Delete all similar | Shift+click the red X |
| Undo | Ctrl+Z |
| Export PDF | Click PDF icon, configure margins/page size, generate |
| Print | Click printer icon for browser print dialog |

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
- **Fonts require internet.** Google Fonts CDN must be reachable; offline use falls back to system fonts.
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
│   ├── reader.css         # All styling (banner, toolbar, bookmarks, dialog, print)
│   └── highlight-vs.css   # VS-style syntax theme
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
