// ticker_tape.js
(function() {
  if (document.getElementById('screener-ticker-tape')) return; // Already injected

  const tapeDiv = document.createElement('div');
  tapeDiv.id = 'screener-ticker-tape';

  const controls = document.createElement('div');
  controls.id = 'screener-tape-controls';

  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'screener-tape-pause-btn';
  pauseBtn.innerHTML = '&#10074;&#10074;'; // ⏸
  pauseBtn.title = 'Pause ticker tape';
  controls.appendChild(pauseBtn);
  tapeDiv.appendChild(controls);
  
  const container = document.createElement('div');
  container.className = 'screener-marquee-container';
  
  const marquee = document.createElement('div');
  marquee.className = 'screener-marquee';
  
  container.appendChild(marquee);
  tapeDiv.appendChild(container);
  
  document.documentElement.appendChild(tapeDiv);
  document.documentElement.classList.add('screener-tape-active');

  let isPaused = false;
  function updatePauseState(paused) {
    isPaused = paused;
    if (isPaused) {
      marquee.classList.add('paused');
      pauseBtn.innerHTML = '&#9654;'; // ▶
      pauseBtn.title = 'Resume ticker tape';
    } else {
      marquee.classList.remove('paused');
      pauseBtn.innerHTML = '&#10074;&#10074;'; // ⏸
      pauseBtn.title = 'Pause ticker tape';
    }
  }

  chrome.storage.local.get(['tapePaused'], (res) => {
    updatePauseState(!!res.tapePaused);
  });

  pauseBtn.onclick = (e) => {
    e.stopPropagation();
    isPaused = !isPaused;
    updatePauseState(isPaused);
    chrome.storage.local.set({ tapePaused: isPaused });
  };

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
      
      // Add All Configured Indices (Nifty 50, Sensex, Bank Nifty, S&P 500)
      for (const [idxName, idx] of Object.entries(indices)) {
        if (!idx || !idx.price) continue;
        const isUp = idx.changeDir === 'up' || parseFloat(idx.changePct) >= 0;
        const color = isUp ? '#81c995' : '#f28b82';
        const sign = isUp ? '\u25B2' : '\u25BC';
        
        let flashClass = '';
        if (idx.flash && (Date.now() - (idx.flashTime || 0) < 5000)) {
           flashClass = idx.flash === 'up' ? 'screener-tape-flash-up' : 'screener-tape-flash-down';
        }

        const formattedPrice = (idx.price.startsWith('\u20B9') || idx.price.startsWith('$')) ? idx.price : `\u20B9${idx.price}`;

        html += `
          <div class="screener-ticker-item" style="color: #ff9800;">
            <span class="screener-ticker-name">${idxName}</span>
            <span class="screener-ticker-price ${flashClass}" style="color: #ff9800;">${formattedPrice}</span>
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
    if (namespace === 'local') {
      if (changes.tapePaused !== undefined) {
        updatePauseState(!!changes.tapePaused.newValue);
      }
      if (changes.cachedData || changes.screenerWatchlist) {
        renderTape();
      }
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
}, 1000);
