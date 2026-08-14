// Background service worker
// Handles messaging between content script and reader page

// ===== Keyboard shortcut command =====
// Allows extraction via Ctrl+Shift+Z without opening the popup.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'extract-article') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  try {
    // Step 1: inject math-grabber in MAIN world (best-effort)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        files: ['math-grabber.js']
      });
    } catch (_) {
      // MAIN-world injection can fail on restricted pages; proceed anyway.
    }

    // Step 2: inject Readability + content.js in ISOLATED world
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'content.js']
    });
  } catch (err) {
    console.warn('ZenReader: extraction via shortcut failed:', err);
  }
});



// Listen for extracted article data from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ARTICLE_EXTRACTED') {
    // Store the article data and open reader page
    chrome.storage.local.set({ articleData: message.data }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
    });

    // Save to article history — skip in incognito to honor private browsing
    if (!chrome.extension.inIncognitoContext) {
      saveToHistory(message.data);
    }
    return false; // no async response needed
  }



  if (message.type === 'FETCH_IMAGE') {
    // Fetch a remote image from the background worker. Because the service
    // worker has host_permissions, this bypasses the page's cross-origin/
    // referrer restrictions that cause some CDNs to 404 <img> requests.
    // Returns a data: URL the reader can display. Fully generic (any host).
    fetchImageAsDataUrl(message.url)
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response — keep channel open
  }

  if (message.type === 'GENERATE_PDF') {
    // sender.tab is undefined for extension pages; use the tabId passed in the message
    const tabId = message.tabId;
    handlePdfGeneration(tabId, message.options)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response — keep channel open
  }

  // Unknown message type — don't hold the channel open
  return false;
});

/**
 * Fetches a remote image and returns it as a data: URL. Runs in the service
 * worker where host_permissions allow reading cross-origin bytes; sends no
 * referrer so hotlink-protected CDNs serve the image. Generic (any host).
 */
async function fetchImageAsDataUrl(url) {
  const resp = await fetch(url, { referrer: '', referrerPolicy: 'no-referrer' });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const blob = await resp.blob();
  if (!blob || blob.size === 0) throw new Error('empty image');
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const type = blob.type || 'image/png';
  return `data:${type};base64,${b64}`;
}

// ===== Article History =====
const MAX_HISTORY = 30;

function saveToHistory(articleData) {
  chrome.storage.local.get('articleHistory', (result) => {
    const history = result.articleHistory || [];

    // Remove any existing entry for this URL (de-duplicate)
    const url = articleData.url;
    const filtered = url
      ? history.filter(entry => entry.url !== url)
      : history;

    // Add new entry at the end (newest last)
    filtered.push({
      title: articleData.title || 'Untitled',
      url: articleData.url || '',
      byline: articleData.byline || '',
      timestamp: Date.now(),
      data: articleData
    });

    // Cap at MAX_HISTORY (remove oldest from front)
    while (filtered.length > MAX_HISTORY) {
      filtered.shift();
    }

    chrome.storage.local.set({ articleHistory: filtered });
  });
}

// Page size dimensions in inches
const PAGE_SIZES = {
  a4: { width: 8.27, height: 11.69 },
  letter: { width: 8.5, height: 11 },
  legal: { width: 8.5, height: 14 }
};

/**
 * Generates a PDF using Chrome DevTools Protocol (Page.printToPDF)
 * and triggers a download.
 */
async function handlePdfGeneration(tabId, options) {
  const { filename, pageSize, marginTop, marginRight, marginBottom, marginLeft } = options;
  const debuggee = { tabId };

  try {
    // Attach debugger to the tab
    await chrome.debugger.attach(debuggee, '1.3');

    // Get page dimensions
    const dims = PAGE_SIZES[pageSize] || PAGE_SIZES.a4;

    // Convert margins from mm to inches (1 inch = 25.4 mm)
    const mTop = marginTop / 25.4;
    const mRight = marginRight / 25.4;
    const mBottom = marginBottom / 25.4;
    const mLeft = marginLeft / 25.4;

    // Generate PDF with native Chrome rendering
    const result = await chrome.debugger.sendCommand(debuggee, 'Page.printToPDF', {
      printBackground: true,
      preferCSSPageSize: false,
      paperWidth: dims.width,
      paperHeight: dims.height,
      marginTop: mTop,
      marginRight: mRight,
      marginBottom: mBottom,
      marginLeft: mLeft,
      generateDocumentOutline: true,
      generateTaggedPDF: true,
      displayHeaderFooter: false
    });

    // Detach debugger
    await chrome.debugger.detach(debuggee);

    // Convert base64 PDF to a data URL and download
    const dataUrl = 'data:application/pdf;base64,' + result.data;

    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: true
    });

    return { success: true, downloadId };
  } catch (err) {
    // Ensure debugger is detached on error
    try {
      await chrome.debugger.detach(debuggee);
    } catch (_) {
      // already detached, ignore
    }
    throw err;
  }
}
