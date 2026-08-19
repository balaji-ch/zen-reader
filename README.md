# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with native PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Bookmarks panel** — Floating draggable outline built from headings (H1-H6), bookmark icons, active section highlight, scroll-to-top chevron
- **Dark mode** — Full dark theme (neutral grays, VS Code Dark+ syntax highlighting). Auto-detects system preference.
- **Reading progress** — Thin gradient bar at the top; hover anywhere on it to see percentage
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
- **Edit tips** — Contextual hints shown when edit mode is first activated (Alt+T to toggle manually)
- **Incognito support** — Works in private mode; history and reading positions are not saved
- **Edit mode** — Toggle pencil icon (or Alt+E) to enable hover-to-delete and double-click-to-edit. Alt+hover also works as a shortcut.
- **Grouped deletion** — Shift+click the delete button to remove all similar elements at once
- **Undo support** — Ctrl+Z to undo deletions, text edits, and image resizes (up to 50 actions)
- **Image resize** — Click any image to select it, then resize to 25%, 50%, 75%, or 100% width. Ctrl+click to select multiple images
- **Keyboard shortcuts** — Alt+? shows full cheatsheet. Alt+ B/D/F/E/O/T/P/S/M for all actions, Esc to close panels
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

1. Download `ZenReader v3.0.1.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader icon (or press `Ctrl+Shift+Z`)
3. The article opens in a clean reader view
4. Press `Alt+?` for the full keyboard shortcuts cheatsheet

The toolbar groups buttons into **View** / **Edit** / **Export**. It auto-collapses after 10s; drag the grip to reposition, click minus to minimize.

## PDF vs Print

- **PDF** (`Alt+S`) — Generates a bookmarked, tagged, accessible `.pdf` with configurable margins and page size. Headings become PDF outline entries. Includes all edits/resizes.
- **Print** (`Alt+P`) — Opens the native browser print dialog. Use for quick printouts or if you prefer the system flow.

> Chrome briefly shows "debugging started" during PDF generation — this is expected (the extension uses the DevTools Protocol to access the native renderer).

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
├── reader.html            # Reader view shell
├── reader/                # Reader view modules (rendering, bookmarks, edit, export, toolbar)
├── css/
│   ├── fonts.css          # Bundled @font-face declarations
│   ├── reader.css         # All styling (banner, toolbar, bookmarks, dark mode, print)
│   └── highlight-vs.css   # VS-style syntax theme
├── fonts/                 # Bundled woff2 fonts (13 families, latin subset)
├── lib/
│   ├── Readability.js     # Mozilla Readability
│   ├── dompurify/         # DOMPurify (sanitizes extracted article HTML before render)
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

See [Releases](https://github.com/balaji-ch/zen-reader/releases) for full version history.

## License

ISC
