// Popup script - triggers article extraction
document.getElementById('btn-extract').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.textContent = 'Extracting...';

  try {
    // Step 1: run the MathJax source grabber in the page's MAIN world. This
    // recovers the original LaTeX from MathJax's in-memory store (the rendered
    // DOM often no longer contains it) and stamps it onto the rendered nodes as
    // data-zen-tex / data-zen-display attributes. Runs FIRST so the attributes
    // exist on the shared DOM before content.js clones it. Best-effort: on pages
    // without MathJax this is a no-op. Failures here must not block extraction.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        files: ['math-grabber.js']
      });
    } catch (e) {
      // MAIN-world injection can be disallowed on some pages; extraction can
      // still proceed with the DOM-based math fallbacks in content.js.
      console.warn('ZenReader: math grabber injection skipped:', e);
    }

    // Step 2: run extraction in the ISOLATED world (default). Readability +
    // preprocessMath read the data-zen-tex attributes left by step 1.
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
