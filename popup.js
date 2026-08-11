// Popup script - triggers article extraction
document.getElementById('btn-extract').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'content.js']
    });
    window.close();
  } catch (err) {
    console.error('Failed to extract:', err);
  }
});
