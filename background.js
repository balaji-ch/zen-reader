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
