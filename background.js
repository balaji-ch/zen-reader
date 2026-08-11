// Background service worker
// Handles messaging between content script and reader page

chrome.action.onClicked.addListener(async (tab) => {
  // Inject content script to extract article
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'content.js']
    });
  } catch (err) {
    console.error('Failed to inject content script:', err);
  }
});

// Listen for extracted article data from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ARTICLE_EXTRACTED') {
    // Store the article data and open reader page
    chrome.storage.local.set({ articleData: message.data }, () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
    });
  }
  return true;
});
