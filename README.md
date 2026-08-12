# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored left borders (Python, C++, Rust, JS, etc.)
- **PDF export** — Generate PDFs with configurable margins (per-side, in mm), page size selection (A4/Letter/Legal), and automatic bookmarks from headings
- **Custom fonts** — Adjust body and code font family, size, and weight from the toolbar
- **Inline text editing** — Double-click any paragraph or heading to edit text directly
- **Element removal** — Hover over any paragraph, image, or block to delete it with the red X button
- **Grouped deletion** — Shift+click the delete button to remove all similar elements at once (great for repetitive noise like "click to fullsize")
- **Undo support** — Ctrl+Z to undo deletions, text edits, image resizes, and cleanup operations (up to 50 actions)
- **Image resize** — Click any image to select it, then resize to 25%, 50%, 75%, or 100% width. Ctrl+click to select multiple images
- **Noise cleanup** — "Clean up" toolbar button strips common platform noise (e.g., "click to fullsize", "tap to view", "image by author")
- **Smart page breaks** — Headings stay with their content; code blocks and images don't split across pages
- **Ligature-free code** — Code blocks disable font ligatures to correctly display tokens like `<|end_of_text|>`

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

1. Download `zen-reader-v1.1.0.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader toolbar icon
3. The article opens in a clean reader view
4. Use the toolbar and keyboard shortcuts:

| Action | How |
|--------|-----|
| Adjust fonts | Click **Text** or **Code** buttons in toolbar |
| Edit text | Double-click any paragraph or heading |
| Delete element | Hover and click the red X |
| Delete all similar | Shift+click the red X |
| Resize images | Click image to select, use resize bar (Ctrl+click for multi-select) |
| Clean up noise | Click **Clean up** button in toolbar |
| Undo | Ctrl+Z |
| Export PDF | Click **PDF**, configure margins/page size, generate |
| Print | Click **Print** for browser print dialog |

A hints toast appears on load with a summary of these shortcuts (visible for 15 seconds).

## PDF Options

When you click the PDF button, a dialog appears with:

| Setting | Description |
|---------|-------------|
| Margins | **No Margin** (0mm), **Minimal** (5mm all sides), or **Custom** (per-side control, 0-50mm) |
| Page size | A4, Letter, or Legal |

The generated PDF includes:
- Bookmarks/outline from article headings (H1-H4)
- Page-break protection (headings kept with content, code blocks don't split)
- All edits, deletions, and image resizes reflected in the output

## Print / PDF Notes

- **Print dialog (Ctrl+P / Print button):** Uses the browser's print engine. Fonts render via Google Fonts. "Save as PDF" in the print dialog embeds font glyphs and produces selectable text.
- **PDF button (html2pdf.js):** Rasterizes the page (image-based PDF). Text is not selectable, but fonts always render correctly regardless of system fonts. Bookmarks are included.
- **All changes reflected:** Edited text, deleted elements, and resized images all appear in both print and PDF output. Interactive UI elements (resize bar, delete button, selection outlines) are automatically hidden.

## Known Limitations

- **PDF is image-based, not text-based.** The PDF export uses html2pdf.js (html2canvas + jsPDF), which rasterizes the page. Text is not selectable or searchable. Use the **Print** button for selectable text (but without bookmarks).
- **Cannot extract from restricted pages.** Chrome prevents content script injection on `chrome://`, `edge://`, `chrome-extension://`, Chrome Web Store pages, and `file://` URLs.
- **Math rendering (MathJax/KaTeX) is not supported.** Articles with LaTeX math notation will show raw math source rather than rendered equations.
- **Very long articles may produce large PDFs.** Since the PDF is image-based at 2x scale, articles with many pages can result in large file sizes.

## Project Structure

```
zen-reader/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker
├── content.js             # Article extraction (injected into pages)
├── popup.html / popup.js  # Extension popup
├── reader.html / reader.js # Reader view + PDF generation
├── css/
│   ├── reader.css         # All styling (reader, toolbar, dialog, page-breaks)
│   └── highlight-vs.css   # VS-style syntax theme
├── lib/
│   ├── Readability.js     # Mozilla Readability
│   ├── highlight.min.js   # highlight.js
│   └── html2pdf.bundle.min.js  # html2pdf.js (html2canvas + jsPDF)
└── icons/                 # Extension icons (16/48/128px)
```

## Building icons

If you need to regenerate icons from the source SVG:

```bash
npm install
node generate-icons.js
```

## About .crx files

Chrome extensions distributed through the Chrome Web Store are packaged as signed `.crx` files by Google. For sideloading (developer use), Chrome requires loading the unpacked source directory directly. Standalone `.crx` installs are blocked by Chrome unless enterprise-managed.

To pack a `.crx` manually (not needed for normal use):
1. Go to `chrome://extensions`
2. Click **Pack extension**
3. Select this directory as the root
4. Chrome generates a `.crx` and a `.pem` key file (keep the `.pem` private)

## License

ISC
