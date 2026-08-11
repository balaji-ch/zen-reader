# ZenReader

A Chrome extension that transforms cluttered web articles into a clean, distraction-free reading experience with PDF export.

## Features

- **Article extraction** — Uses Mozilla Readability to strip ads, navigation, and clutter from any article
- **Syntax highlighting** — Code blocks are highlighted with language-specific colored badges (Python, C++, Rust, JS, etc.)
- **PDF export** — Generate PDFs with configurable margins (per-side, in mm), page size selection (A4/Letter/Legal), and automatic bookmarks from headings
- **Custom fonts** — Adjust body and code font family, size, and weight from the toolbar
- **Element removal** — Hover over any paragraph, image, or block to delete it before exporting
- **Smart page breaks** — Headings stay with their content; code blocks and images don't split across pages

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

1. Download the latest `.zip` from [Releases](https://github.com/balaji-ch/zen-reader/releases)
2. Extract to a folder
3. Load unpacked in Chrome as described above

## Usage

1. Navigate to any article
2. Click the ZenReader toolbar icon
3. The article opens in a clean reader view
4. Use the toolbar to:
   - Adjust text/code fonts
   - Click **PDF** to configure margins and page size, then generate
   - Click **Print** for browser print dialog
   - Hover over elements and click the red X to remove them

## PDF Options

When you click the PDF button, a dialog appears with:

| Setting | Description |
|---------|-------------|
| Top/Right/Bottom/Left margins | Individual margin control in millimeters (0–50mm) |
| Page size | A4, Letter, or Legal |

The generated PDF includes:
- Bookmarks/outline from article headings (H1–H4)
- Page-break protection (headings kept with content, code blocks don't split)

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

If you need to regenerate icons from a source SVG:

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
