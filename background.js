// Background service worker
// Handles messaging between content script and reader page

// Listen for extracted article data from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ARTICLE_EXTRACTED') {
    // Store the article data and open reader page
    chrome.storage.local.set({ articleData: message.data }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
    });
  }

  if (message.type === 'FETCH_IMAGE') {
    // Fetch a remote image from the background worker. Because the service
    // worker has host_permissions, this bypasses the page's cross-origin/
    // referrer restrictions that cause some CDNs to 404 <img> requests.
    // Returns a data: URL the reader can display. Fully generic (any host).
    fetchImageAsDataUrl(message.url)
      .then((dataUrl) => sendResponse({ success: true, dataUrl }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // async response
  }

  if (message.type === 'GENERATE_PDF') {
    // sender.tab is undefined for extension pages; use the tabId passed in the message
    const tabId = message.tabId;
    handlePdfGeneration(tabId, message.options)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // keep message channel open for async response
  }

  return true;
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
