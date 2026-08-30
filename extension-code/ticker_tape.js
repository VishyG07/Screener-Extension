// ticker_tape.js
(function() {
  if (document.getElementById('screener-ticker-tape')) return; // Already injected

  const tapeDiv = document.createElement('div');
  tapeDiv.id = 'screener-ticker-tape';
  
  const container = document.createElement('div');
  container.className = 'screener-marquee-container';
  
  const marquee = document.createElement('div');
  marquee.className = 'screener-marquee';
  
  container.appendChild(marquee);
  tapeDiv.appendChild(container);
  
  document.documentElement.appendChild(tapeDiv);
  document.documentElement.classList.add('screener-tape-active');

  function renderTape() {
    chrome.storage.local.get(['screenerWatchlist', 'cachedData', 'marketIndices', ''], (res) => {
      const isEnabled = true;
      if (!isEnabled) {
        tapeDiv.style.display = 'none';
        document.documentElement.classList.remove('screener-tape-active');
        return;
      }
      
      const list = res.screenerWatchlist || [];
      const cached = res.cachedData || {};
      const indices = res.marketIndices || {};
      
      if (list.length === 0 && !indices['NIFTY 50']) {
        tapeDiv.style.display = 'none';
        document.documentElement.classList.remove('screener-tape-active');
        return;
      }
      
      tapeDiv.style.display = 'flex';
      document.documentElement.classList.add('screener-tape-active');
      
      marquee.innerHTML = '';
      let html = '';
      
      // Add Indices First
      if (indices['SENSEX']) {
        const idx = indices['SENSEX'];
        const isUp = parseFloat(idx.changePct) >= 0;
        const color = isUp ? '#81c995' : '#f28b82';
        const sign = isUp ? '▲' : '▼';
        
        let flashClass = '';
        if (idx.flash && (Date.now() - (idx.flashTime || 0) < 5000)) {
           flashClass = idx.flash === 'up' ? 'screener-tape-flash-up' : 'screener-tape-flash-down';
        }

        html += `
          <div class="screener-ticker-item" style="color: #ff9800;">
            <span class="screener-ticker-name">SENSEX</span>
            <span class="screener-ticker-price ${flashClass}" style="color: #ff9800;">₹${idx.price}</span>
            <span style="color: ${color}; font-size: 12px; margin-left: 6px;">${sign} ${Math.abs(parseFloat(idx.changePct)).toFixed(2)}%</span>
          </div>
        `;
      }
      if (indices['NIFTY 50']) {
        const idx = indices['NIFTY 50'];
        const isUp = parseFloat(idx.changePct) >= 0;
        const color = isUp ? '#81c995' : '#f28b82';
        const sign = isUp ? '▲' : '▼';
        
        let flashClass = '';
        if (idx.flash && (Date.now() - (idx.flashTime || 0) < 5000)) {
           flashClass = idx.flash === 'up' ? 'screener-tape-flash-up' : 'screener-tape-flash-down';
        }

        html += `
          <div class="screener-ticker-item" style="color: #ff9800;">
            <span class="screener-ticker-name">NIFTY 50</span>
            <span class="screener-ticker-price ${flashClass}" style="color: #ff9800;">₹${idx.price}</span>
            <span style="color: ${color}; font-size: 12px; margin-left: 6px;">${sign} ${Math.abs(parseFloat(idx.changePct)).toFixed(2)}%</span>
          </div>
        `;
      }
      
      for (const ticker of list) {
        const data = cached[ticker];
        if (data && data.success) {
          const price = data.ratios['Current Price'] || '-';
          
          let pctHtml = '';
          if (data.changePct) {
            const color = data.changeDir === 'up' ? '#81c995' : '#f28b82';
            const sign = data.changeDir === 'up' ? '▲' : '▼';
            pctHtml = `<span style="color: ${color}; font-size: 12px; margin-left: 6px;">${sign} ${data.changePct}</span>`;
          }

          let flashClass = '';
          if (data.flash && (Date.now() - (data.flashTime || 0) < 5000)) {
            flashClass = data.flash === 'up' ? 'screener-tape-flash-up' : 'screener-tape-flash-down';
          }

          html += `
            <div class="screener-ticker-item">
              <span class="screener-ticker-name">${data.companyName || ticker}</span>
              <span class="screener-ticker-price ${flashClass}">${price}</span>
              ${pctHtml}
            </div>
          `;
        }
      }
      
      if (html === '') {
        html = `<div class="screener-ticker-item">Loading Screener Watchlist...</div>`;
      }
      
      marquee.innerHTML = html;
    });
  }

  // Initial render
  renderTape();

  // Listen for updates from background script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'WATCHLIST_UPDATED') {
      renderTape();
    }
  });

  // Also listen to storage changes directly
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && (changes.cachedData || changes.screenerWatchlist || false)) {
      renderTape();
    }
  });
})();
// Keep background worker alive and trigger ultra-fast price polling
setInterval(() => {
  try {
    chrome.runtime.sendMessage({ type: 'PING' }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  } catch(e) {}
}, 10000);
