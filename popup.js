// Popup script - triggers article extraction
document.getElementById('btn-extract').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.textContent = 'Extracting...';

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'content.js']
    });
    // Give content script time to execute, extract article, and send message
    // before closing the popup (closing too early can drop the message channel)
    setTimeout(() => window.close(), 800);
  } catch (err) {
    console.error('Failed to extract:', err);
    btn.disabled = false;
    btn.textContent = 'Extract Article';
    const errMsg = document.createElement('p');
    errMsg.style.cssText = 'color:#d93025;font-size:12px;margin-top:8px;';
    if (err.message && err.message.includes('Cannot access')) {
      errMsg.textContent = 'Cannot extract from this page (restricted URL).';
    } else {
      errMsg.textContent = 'Error: ' + (err.message || 'Unknown error');
    }
    btn.parentNode.appendChild(errMsg);
  }
});
