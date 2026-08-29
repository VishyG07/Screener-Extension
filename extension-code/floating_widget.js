// floating_widget.js
(function() {
  if (document.getElementById('screener-fw-container')) return; // Already injected

  // 1. Construct HTML
  const container = document.createElement('div');
  container.id = 'screener-fw-container';
  container.style.display = 'none'; // Hidden initially to avoid spamming the screen on every page. We'll show the minimized tab.

  container.innerHTML = `
    <div id="screener-fw-header">
      <span class="screener-fw-title">Watchlist</span>
      <div class="screener-fw-controls">
        <div class="screener-fw-search">
          <input type="text" id="screener-fw-input" placeholder="Add ticker...">
          <div id="screener-fw-suggestions"></div>
        </div>
        <button id="screener-fw-btn-min" class="screener-fw-btn" title="Minimize">&minus;</button>
        <button id="screener-fw-btn-close" class="screener-fw-btn" title="Close">&times;</button>
      </div>
    </div>
    
    <div id="screener-fw-content">
      <table id="screener-fw-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>Trend</th>
            <th>Price</th>
            <th>P/E</th>
            <th>M.Cap</th>
            <th>ROCE</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="screener-fw-tbody">
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(container);

  const minimizedTab = document.createElement('div');
  minimizedTab.id = 'screener-fw-minimized';
  minimizedTab.innerHTML = '&#128200; Screener'; // Chart icon
  minimizedTab.title = "Open Screener Watchlist";
  document.body.appendChild(minimizedTab);

  // Restore state from storage
  chrome.storage.local.get(['fwState', 'extensionEnabled'], (res) => {
    if (res.extensionEnabled === false) {
      container.style.display = 'none';
      minimizedTab.style.display = 'none';
      return;
    }
    
    if (res.fwState === 'open') {
      container.style.display = 'flex';
      minimizedTab.style.display = 'none';
    } else if (res.fwState === 'closed') {
      // closed completely
    } else {
      // default is minimized
      minimizedTab.style.display = 'block';
    }
  });

  // UI elements
  const btnMin = document.getElementById('screener-fw-btn-min');
  const btnClose = document.getElementById('screener-fw-btn-close');
  const inputEl = document.getElementById('screener-fw-input');
  const suggestionsEl = document.getElementById('screener-fw-suggestions');
  const tbodyEl = document.getElementById('screener-fw-tbody');
  const header = document.getElementById('screener-fw-header');

  btnMin.onclick = () => {
    container.style.display = 'none';
    minimizedTab.style.display = 'block';
    chrome.storage.local.set({ fwState: 'minimized' });
  };

  btnClose.onclick = () => {
    container.style.display = 'none';
    minimizedTab.style.display = 'none';
    chrome.storage.local.set({ fwState: 'closed' });
  };

  minimizedTab.onclick = () => {
    container.style.display = 'flex';
    minimizedTab.style.display = 'none';
    chrome.storage.local.set({ fwState: 'open' });
  };

  // --- Drag Logic ---
  let isDragging = false;
  let offsetX, offsetY;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.screener-fw-controls')) return;
    isDragging = true;
    const rect = container.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    if (!isDragging) return;
    let newX = e.clientX - offsetX;
    let newY = e.clientY - offsetY;
    const maxX = window.innerWidth - container.offsetWidth;
    const maxY = window.innerHeight - container.offsetHeight;
    newX = Math.max(0, Math.min(newX, maxX));
    newY = Math.max(0, Math.min(newY, maxY));
    container.style.left = newX + 'px';
    container.style.top = newY + 'px';
    container.style.right = 'auto'; // release right anchor
  }

  function onMouseUp() {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // --- Render Table ---
  function removeTicker(ticker) {
    chrome.storage.local.get(['screenerWatchlist'], (res) => {
      let list = res.screenerWatchlist || [];
      list = list.filter(t => t !== ticker);
      chrome.storage.local.set({ screenerWatchlist: list }, () => renderTable());
    });
  }

  function createSparkline(data) {
    if (!data || data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    
    const width = 50;
    const height = 18;
    
    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isUp = data[data.length - 1] >= data[0];
    const color = isUp ? '#188038' : '#d93025';

    return `<svg viewBox="-2 -2 ${width + 4} ${height + 4}" width="${width}" height="${height}" style="overflow:visible;"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  function renderTable() {
    chrome.storage.local.get(['screenerWatchlist', 'cachedData'], (res) => {
      const list = res.screenerWatchlist || [];
      const cached = res.cachedData || {};
      
      const tbody = document.getElementById('screener-fw-tbody');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Empty Watchlist</td></tr>';
        return;
      }
      
      for (const ticker of list) {
        const data = cached[ticker];
        const tr = document.createElement('tr');
        
        if (!data || !data.success) {
          tr.innerHTML = `
            <td>${ticker}</td>
            <td colspan="5" style="color:#d93025;">${data ? 'Error' : 'Syncing...'}</td>
            <td><button class="screener-fw-del" data-ticker="${ticker}" title="Delete">&#128465;</button></td>
          `;
        } else {
          const price = data.ratios['Current Price'] || '-';
          const pe = data.ratios['Stock P/E'] || '-';
          const mcap = data.ratios['Market Cap'] || '-';
          const roce = data.ratios['ROCE'] || '-';
          
          let pctHtml = '';
          if (data.changePct) {
            const color = data.changeDir === 'up' ? '#188038' : '#d93025';
            const sign = data.changeDir === 'up' ? '▲' : '▼';
            pctHtml = `<div style="color:${color}; font-size:11px;">${sign} ${data.changePct}</div>`;
          }

          const sparklineHtml = createSparkline(data.sparkline);
          
          tr.innerHTML = `
            <td><a href="https://www.screener.in/company/${ticker}/" target="_blank">${data.companyName}</a></td>
            <td>${sparklineHtml}</td>
            <td>${price} ${pctHtml}</td>
            <td>${pe}</td>
            <td>${mcap}</td>
            <td>${roce}</td>
            <td><button class="screener-fw-del" data-ticker="${ticker}" title="Delete">&#128465;</button></td>
          `;
        }
        tbody.appendChild(tr);
        
        const delBtn = tr.querySelector('.screener-fw-del');
        if (delBtn) delBtn.onclick = () => removeTicker(ticker);
      }
    });
  }

  // --- Autocomplete Logic ---
  let debounceTimer;
  inputEl.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = inputEl.value.trim();
    if (query.length < 2) {
      suggestionsEl.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      let results = [];
      try {
        // Route through background service worker (has host_permissions)
        results = await chrome.runtime.sendMessage({ type: 'SEARCH_COMPANY', query: query });
      } catch (err) {
        // Fallback: try direct fetch
        try {
          const res = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`);
          if (res.ok) results = await res.json();
        } catch (e) {}
      }
      
      if (results && results.length > 0) {
        suggestionsEl.innerHTML = '';
        results.forEach(item => {
          const div = document.createElement('div');
          div.className = 'screener-fw-s-item';
          div.textContent = item.name;
          div.onclick = () => {
            const parts = item.url.split('/');
            const ticker = parts[2];
            inputEl.value = '';
            suggestionsEl.style.display = 'none';
            
            chrome.storage.local.get(['screenerWatchlist', 'portfolios'], (res) => {
              let list = res.screenerWatchlist || [];
              let portfolios = res.portfolios || {};
              if (!portfolios['Default']) portfolios['Default'] = list;
              
              if (!list.includes(ticker)) {
                list.push(ticker);
                portfolios['Default'] = list;
                chrome.storage.local.set({ screenerWatchlist: list, portfolios: portfolios }, () => {
                  chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
                  renderTable();
                });
              }
            });
          };
          suggestionsEl.appendChild(div);
        });
        suggestionsEl.style.display = 'block';
      } else {
        suggestionsEl.style.display = 'none';
      }
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.screener-fw-search')) {
      if (suggestionsEl) suggestionsEl.style.display = 'none';
    }
  });

  // Listen for updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'WATCHLIST_UPDATED') renderTable();
  });
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.cachedData) renderTable();
      if (changes.extensionEnabled) {
        const isEnabled = changes.extensionEnabled.newValue !== false;
        if (!isEnabled) {
          container.style.display = 'none';
          minimizedTab.style.display = 'none';
        } else {
          // Re-evaluate state
          chrome.storage.local.get(['fwState'], (res) => {
            if (res.fwState === 'open') {
              container.style.display = 'flex';
              minimizedTab.style.display = 'none';
            } else if (res.fwState !== 'closed') {
              minimizedTab.style.display = 'block';
            }
          });
        }
      }
    }
  });

  renderTable();
})();


// --- Sparklines SVG Builder ---
async function buildSparkline(ticker) {
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.NS?range=7d&interval=1d`);
    const data = await res.json();
    const prices = data.chart.result[0].indicators.quote[0].close.filter(p => p !== null);
    if (prices.length < 2) return '';

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    
    const width = 60;
    const height = 20;
    
    const points = prices.map((p, i) => {
      const x = (i / (prices.length - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    const isUp = prices[prices.length - 1] >= prices[0];
    const color = isUp ? '#188038' : '#d93025';

    return `<svg width="${width}" height="${height}" style="margin-top:4px;"><polyline fill="none" stroke="${color}" stroke-width="1.5" points="${points}"/></svg>`;
  } catch(e) {
    return '';
  }
}
