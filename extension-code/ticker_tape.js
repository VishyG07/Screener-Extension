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

  // --- State Variables ---
  let isPaused = false;
  let isDragging = false;
  let isHovered = false;
  let startX = 0;
  let dragStartX = 0;
  let currentX = 0;
  let speed = 0.8; // Default 1x speed in pixels per frame

  // Read stored preferences (controlled via side panel)
  chrome.storage.local.get(['tapePaused', 'tapeSpeedMultiplier', 'tapeSpeed'], (res) => {
    isPaused = res.tapePaused === true;
    if (res.tapeSpeedMultiplier !== undefined && typeof res.tapeSpeedMultiplier === 'number') {
      speed = res.tapeSpeedMultiplier * 0.8;
    } else if (res.tapeSpeed !== undefined && typeof res.tapeSpeed === 'number') {
      speed = res.tapeSpeed;
    }
  });

  // Listen for control updates from side panel
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.tapePaused !== undefined) {
        isPaused = changes.tapePaused.newValue === true;
      }
      if (changes.tapeSpeedMultiplier !== undefined) {
        speed = changes.tapeSpeedMultiplier.newValue * 0.8;
      } else if (changes.tapeSpeed !== undefined) {
        speed = changes.tapeSpeed.newValue;
      }
      if (changes.cachedData || changes.screenerWatchlist || changes.marketIndices) {
        renderTape();
      }
    }
  });

  // --- Interactive Grab-and-Drag (Left / Right) ---
  container.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // Left click only
    isDragging = true;
    startX = e.pageX;
    dragStartX = currentX;
    container.classList.add('grabbing');
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.pageX - startX;
    currentX = dragStartX + dx;

    // Infinite loop wrap while dragging
    const halfWidth = marquee.scrollWidth / 2;
    if (halfWidth > 0) {
      if (currentX > 0) {
        currentX -= halfWidth;
        dragStartX -= halfWidth;
      } else if (Math.abs(currentX) >= halfWidth) {
        currentX += halfWidth;
        dragStartX += halfWidth;
      }
    }
    marquee.style.transform = `translate3d(${currentX}px, 0, 0)`;
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      container.classList.remove('grabbing');
    }
  });

  // Mouse wheel and trackpad horizontal scrolling
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    currentX -= delta;

    const halfWidth = marquee.scrollWidth / 2;
    if (halfWidth > 0) {
      if (currentX > 0) {
        currentX -= halfWidth;
      } else if (Math.abs(currentX) >= halfWidth) {
        currentX += halfWidth;
      }
    }
    marquee.style.transform = `translate3d(${currentX}px, 0, 0)`;
  }, { passive: false });

  // Hover detection (temporarily pause scrolling while user actively hovers)
  container.addEventListener('mouseenter', () => { isHovered = true; });
  container.addEventListener('mouseleave', () => { isHovered = false; });

  // Global mousemove safeguard: If cursor moves anywhere outside the container, clear isHovered
  document.addEventListener('mousemove', (e) => {
    if (isHovered && (!container || !container.contains(e.target))) {
      isHovered = false;
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    isHovered = false;
  }, { passive: true });

  // Window blur and visibility safeguards (prevents tape from getting stuck)
  window.addEventListener('blur', () => {
    isHovered = false;
    isDragging = false;
    if (container) container.classList.remove('grabbing');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isHovered = false;
      isDragging = false;
      if (container) container.classList.remove('grabbing');
    }
  });

  // --- Continuous GPU-Accelerated Auto-Scroll Engine ---
  // Uses translate3d which never hits DOM scroll limits or integer truncation issues
  function autoScrollStep() {
    if (!isPaused && !isDragging && !isHovered) {
      currentX -= speed;
      const halfWidth = marquee.scrollWidth / 2;
      if (halfWidth > 0 && Math.abs(currentX) >= halfWidth) {
        currentX += halfWidth;
      }
      marquee.style.transform = `translate3d(${currentX}px, 0, 0)`;
    }
    requestAnimationFrame(autoScrollStep);
  }
  requestAnimationFrame(autoScrollStep);

  // --- Render Tape Content ---
  function renderTape() {
    chrome.storage.local.get(['screenerWatchlist', 'portfolios', 'cachedData', 'marketIndices'], (res) => {
      let list = res.screenerWatchlist || [];
      const portfolios = res.portfolios || {};
      for (const portList of Object.values(portfolios)) {
        if (Array.isArray(portList)) list.push(...portList);
      }
      list = [...new Set(list)];
      const cached = res.cachedData || {};
      const indices = res.marketIndices || {};
      
      if (list.length === 0 && Object.keys(indices).length === 0) {
        tapeDiv.style.display = 'none';
        document.documentElement.classList.remove('screener-tape-active');
        return;
      }
      
      tapeDiv.style.display = 'flex';
      document.documentElement.classList.add('screener-tape-active');
      
      let html = '';
      
      // Add Market Indices (Nifty 50, Sensex, Bank Nifty, S&P 500)
      for (const [idxName, idx] of Object.entries(indices)) {
        if (!idx || !idx.price) continue;
        const isUp = idx.changeDir === 'up' || parseFloat(idx.changePct) >= 0;
        const color = isUp ? '#81c995' : '#f28b82';
        const sign = isUp ? '\u25B2' : '\u25BC';
        
        let flashClass = '';
        if (idx.flash && (Date.now() - (idx.flashTime || 0) < 5000)) {
           flashClass = idx.flash === 'up' ? 'screener-tape-flash-up' : 'screener-tape-flash-down';
        }

        const formattedPrice = (idx.price.startsWith('\u20B9') || idx.price.startsWith('$')) ? idx.price : ('\u20B9' + idx.price);

        html += `
          <div class="screener-ticker-item" style="color: #ff9800;">
            <span class="screener-ticker-name">${idxName}</span>
            <span class="screener-ticker-price ${flashClass}" style="color: #ff9800;">${formattedPrice}</span>
            <span style="color: ${color}; font-size: 12px; margin-left: 6px;">${sign} ${Math.abs(parseFloat(idx.changePct)).toFixed(2)}%</span>
          </div>
        `;
      }
      
      // Add Watchlist Stocks
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
        marquee.innerHTML = `<div class="screener-ticker-item">Loading Screener Watchlist...</div>`;
      } else {
        // Repeat items 4 times so content always spans comfortably beyond screen width
        marquee.innerHTML = html + html + html + html;
      }
      marquee.style.transform = `translate3d(${currentX}px, 0, 0)`;
    });
  }

  // Initial render
  renderTape();

  // Listen for updates from background script and sidepanel
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'WATCHLIST_UPDATED') {
      renderTape();
    }
    if (msg.type === 'TAPE_PAUSE_UPDATE') {
      isPaused = msg.isPaused === true;
    }
    if (msg.type === 'TAPE_SPEED_UPDATE') {
      if (typeof msg.speedMultiplier === 'number') {
        speed = msg.speedMultiplier * 0.8;
      }
    }
  });
})();

// Keep background worker active and trigger price polling from any webpage
setInterval(() => {
  try {
    chrome.runtime.sendMessage({ type: 'PING' }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  } catch(e) {}
}, 1000);
