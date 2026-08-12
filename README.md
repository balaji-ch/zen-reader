# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with native PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored left borders (Python, C++, Rust, JS, etc.)
- **Native PDF export** — Generates real PDFs via Chrome's printing engine with selectable text, searchable content, preserved links, PDF bookmarks/outline from headings, and tagged/accessible output
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

1. Download `zen-reader-v1.2.0.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
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

## PDF Export

When you click the **PDF** button, a dialog appears with:

| Setting | Description |
|---------|-------------|
| Margins | **No Margin** (0mm), **Minimal** (5mm all sides), or **Custom** (per-side control, 0-50mm) |
| Page size | A4, Letter, or Legal |

The generated PDF includes:

- **Selectable and searchable text**
- **Preserved hyperlinks**
- **Preserved images**
- **PDF bookmarks/outline** built from article headings (H1-H6)
- **Tagged PDF** for accessibility (screen reader friendly)
- **Smart page breaks** — headings kept with content, images don't split across pages
- All edits, deletions, and image resizes reflected in the output

The PDF is generated using Chrome's native printing engine via the DevTools Protocol (`Page.printToPDF`), producing the same quality as "Save as PDF" from the print dialog but with automatic bookmarks and tagged structure.

> **Note:** When the PDF is generated, Chrome briefly shows a "debugging started" notification bar. This is expected — the extension uses the Chrome Debugger API to access the native PDF renderer.

## Permissions

| Permission | Reason |
|------------|--------|
| `activeTab` | Access the current page to extract article content |
| `storage` | Persist font preferences and pass article data to the reader |
| `scripting` | Inject the Readability content script into pages |
| `debugger` | Attach to the reader tab to call Chrome's native `Page.printToPDF` |
| `downloads` | Save the generated PDF file to disk |

## Known Limitations

- **Cannot extract from restricted pages.** Chrome prevents content script injection on `chrome://`, `edge://`, `chrome-extension://`, Chrome Web Store pages, and `file://` URLs.
- **Math rendering (MathJax/KaTeX) is not supported.** Articles with LaTeX math notation will show raw math source rather than rendered equations.
- **Debugger notification.** Chrome shows a brief "started debugging this browser" bar during PDF generation. This is a Chrome security measure and cannot be suppressed by extensions.

## Project Structure

```
zen-reader/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker + PDF generation via chrome.debugger
├── content.js             # Article extraction (injected into pages)
├── popup.html / popup.js  # Extension popup
├── reader.html / reader.js # Reader view + PDF export trigger
├── css/
│   ├── reader.css         # All styling (reader, toolbar, dialog, print styles)
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

## License

ISC
