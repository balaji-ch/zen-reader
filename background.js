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
  return true;
});
