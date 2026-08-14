// Popup script - triggers article extraction + shows history

// ===== Extract button =====
document.getElementById('btn-extract').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const btn = document.getElementById('btn-extract');
  btn.disabled = true;
  btn.textContent = 'Extracting...';

  try {
    // Step 1: run the MathJax source grabber in the page's MAIN world.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        files: ['math-grabber.js']
      });
    } catch (e) {
      console.warn('ZenReader: math grabber injection skipped:', e);
    }

    // Step 2: run extraction in the ISOLATED world (default).
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['lib/Readability.js', 'content.js']
    });
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

// ===== History list =====
function renderHistory() {
  const listEl = document.getElementById('history-list');

  chrome.storage.local.get('articleHistory', (result) => {
    const history = result.articleHistory || [];

    if (history.length === 0) {
      listEl.innerHTML = '<li class="history-empty">No recent articles</li>';
      return;
    }

    listEl.innerHTML = '';
    // Show most recent first (stored newest-last, so reverse)
    const items = history.slice().reverse().slice(0, 10);

    items.forEach((entry, idx) => {
      const li = document.createElement('li');
      li.className = 'history-li';

      const a = document.createElement('a');
      a.className = 'history-item';
      a.href = '#';
      a.title = entry.title;

      const textDiv = document.createElement('div');
      textDiv.className = 'history-item-text';

      const titleEl = document.createElement('div');
      titleEl.className = 'history-item-title';
      titleEl.textContent = entry.title || 'Untitled';

      const metaEl = document.createElement('div');
      metaEl.className = 'history-item-meta';
      const domain = entry.url ? new URL(entry.url).hostname : '';
      const timeAgo = formatTimeAgo(entry.timestamp);
      metaEl.textContent = [domain, timeAgo].filter(Boolean).join(' \u00B7 ');

      textDiv.appendChild(titleEl);
      textDiv.appendChild(metaEl);
      a.appendChild(textDiv);

      a.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.storage.local.set({ articleData: entry.data }, () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('reader.html') });
          window.close();
        });
      });

      // Delete button (X) per item
      const delBtn = document.createElement('button');
      delBtn.className = 'history-delete';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Remove from history';
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteHistoryItem(entry.url || entry.timestamp);
        li.remove();
        // If list is now empty show placeholder
        if (listEl.querySelectorAll('.history-li').length === 0) {
          listEl.innerHTML = '<li class="history-empty">No recent articles</li>';
        }
      });

      li.appendChild(a);
      li.appendChild(delBtn);
      listEl.appendChild(li);
    });

    // "Clear all" link at the bottom
    const clearLi = document.createElement('li');
    clearLi.className = 'history-clear';
    const clearLink = document.createElement('a');
    clearLink.href = '#';
    clearLink.textContent = 'Clear all';
    clearLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.storage.local.remove('articleHistory', () => {
        listEl.innerHTML = '<li class="history-empty">No recent articles</li>';
      });
    });
    clearLi.appendChild(clearLink);
    listEl.appendChild(clearLi);
  });
}

function deleteHistoryItem(identifier) {
  chrome.storage.local.get('articleHistory', (result) => {
    let history = result.articleHistory || [];
    history = history.filter((entry) => {
      return (entry.url || entry.timestamp) !== identifier;
    });
    chrome.storage.local.set({ articleHistory: history });
  });
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return minutes + 'm ago';
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours + 'h ago';
  const days = Math.floor(hours / 24);
  if (days < 7) return days + 'd ago';
  return new Date(timestamp).toLocaleDateString();
}

// ===== History toggle (collapsed by default) =====
const historyToggle = document.getElementById('history-toggle');
const historyList = document.getElementById('history-list');
const historyChevron = document.getElementById('history-chevron');
let historyLoaded = false;

historyToggle.addEventListener('click', () => {
  const isHidden = historyList.style.display === 'none';
  if (isHidden) {
    historyList.style.display = '';
    historyChevron.classList.add('open');
    // Load history on first expand (lazy)
    if (!historyLoaded) {
      historyLoaded = true;
      if (chrome.extension.inIncognitoContext) {
        historyList.innerHTML = '<li class="history-empty">History hidden in private mode</li>';
      } else {
        renderHistory();
      }
    }
  } else {
    historyList.style.display = 'none';
    historyChevron.classList.remove('open');
  }
});
