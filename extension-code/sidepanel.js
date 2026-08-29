document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabSearch = document.getElementById('tab-search');
  const tabWatchlist = document.getElementById('tab-watchlist');
  const tabNews = document.getElementById('tab-news');
  const viewSearch = document.getElementById('view-search');
  const viewWatchlist = document.getElementById('view-watchlist');
  const viewNews = document.getElementById('view-news');
  const btnSearch = document.getElementById('btn-search');
  const inputSearch = document.getElementById('input-search');
  const resultsSearch = document.getElementById('results-search');
  const searchSuggestions = document.getElementById('search-suggestions');

  const btnWlAdd = document.getElementById('btn-wl-add');
  const inputWlAdd = document.getElementById('input-wl-add');
  const wlItemsContainer = document.getElementById('wl-items-container');
  const wlSuggestions = document.getElementById('wl-suggestions');

  const themeToggle = document.getElementById('theme-toggle');
  const masterToggle = document.getElementById('master-toggle');
  
  const portfolioSelect = document.getElementById('portfolio-select');
  const btnNewPortfolio = document.getElementById('btn-new-portfolio');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const newsContainer = document.getElementById('news-container');

  let activePortfolio = 'Default';
  // Tab Switching Logic
  function switchTab(activeTab, activeView) {
    [tabSearch, tabWatchlist, tabNews].forEach(t => t.classList.remove('active'));
    [viewSearch, viewWatchlist, viewNews].forEach(v => v.classList.remove('active'));
    
    activeTab.classList.add('active');
    activeView.classList.add('active');
    
    if (activeTab === tabWatchlist) renderWatchlist();
    if (activeTab === tabNews) renderNews();
  }

  tabSearch.addEventListener('click', () => switchTab(tabSearch, viewSearch));
  tabWatchlist.addEventListener('click', () => switchTab(tabWatchlist, viewWatchlist));
  tabNews.addEventListener('click', () => switchTab(tabNews, viewNews));
  // Load Settings
  chrome.storage.local.get(['theme', 'extensionEnabled'], (res) => {
    if (res.theme === 'dark') document.body.classList.add('dark-mode');
    masterToggle.checked = (res.extensionEnabled !== false);
  });

  masterToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ extensionEnabled: e.target.checked });
  });

  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const theme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
    chrome.storage.local.set({ theme });
  });

  // --- Multi-Portfolio Logic ---
  function loadPortfolios() {
    chrome.storage.local.get(['portfolios', 'screenerWatchlist'], (res) => {
      let portfolios = res.portfolios || {};
      
      // Migration for old users
      if (Object.keys(portfolios).length === 0) {
        portfolios['Default'] = res.screenerWatchlist || [];
        chrome.storage.local.set({ portfolios });
      }

      portfolioSelect.innerHTML = '';
      for (const name in portfolios) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        portfolioSelect.appendChild(opt);
      }
      portfolioSelect.value = activePortfolio;
    });
  }
  loadPortfolios();
  renderDefaultSearch();

  portfolioSelect.addEventListener('change', (e) => {
    activePortfolio = e.target.value;
    chrome.storage.local.get(['portfolios'], (res) => {
       const ports = res.portfolios || {};
       chrome.storage.local.set({ screenerWatchlist: ports[activePortfolio] || [] }, () => {
         renderWatchlist();
       });
    });
  });

  btnNewPortfolio.addEventListener('click', () => {
    
    const name = prompt("Enter new portfolio name:");
    if (name && name.trim() !== '') {
      chrome.storage.local.get(['portfolios'], (res) => {
        const ports = res.portfolios || {};
        if (!ports[name]) {
          ports[name] = [];
          activePortfolio = name;
          chrome.storage.local.set({ portfolios: ports, screenerWatchlist: [] }, () => {
            loadPortfolios();
            renderWatchlist();
          });
        }
      });
    }
  });

  // --- Export to CSV ---
  btnExportCsv.addEventListener('click', () => {
    
    chrome.storage.local.get(['portfolios', 'cachedData'], (res) => {
      const list = (res.portfolios || {})[activePortfolio] || [];
      const data = res.cachedData || {};
      
      let csv = "Ticker,Company,Current Price,P/E,Market Cap,ROCE\n";
      for (const ticker of list) {
        const d = data[ticker];
        if (d && d.success) {
          csv += `"${ticker}","${d.companyName}","${d.ratios['Current Price']||''}","${d.ratios['Stock P/E']||''}","${d.ratios['Market Cap']||''}","${d.ratios['ROCE']||''}"\n`;
        }
      }
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Screener_Watchlist_${activePortfolio}.csv`;
      a.click();
    });
  });

  // --- Smart Verdict Engine ---
  function generateVerdict(ratios) {
    const peRaw = ratios['Stock P/E'];
    const roceRaw = ratios['ROCE'];
    const isDark = document.body.classList.contains('dark-mode');
    const bg = isDark ? '#303134' : '#f1f3f4';
    const border = isDark ? '1px solid #3c4043' : 'none';
    const labelColor = isDark ? '#9aa0a6' : '#5f6368';

    if (!peRaw || !roceRaw) return `<div style="background:${bg}; border:${border}; padding:12px; border-radius:8px; margin-top:12px; font-size:13px;"><span style="color:${labelColor}; font-weight:600;">AI Verdict:</span> <span style="color:#fbbc04; font-weight:500;">Not enough data to formulate a verdict.</span></div>`;
    
    const pe = parseFloat(peRaw.replace(/[^\d\.\-]/g, ''));
    const roce = parseFloat(roceRaw.replace(/[^\d\.\-]/g, ''));
    
    let verdict = "";
    let sentimentColor = isDark ? '#9aa0a6' : '#5f6368';
    
    if (pe < 15 && roce > 20) {
      verdict = "[Undervalued] Gem with highly efficient capital return.";
      sentimentColor = isDark ? '#81c995' : '#188038';
    } else if (pe > 40 && roce > 15) {
      verdict = "[Expensive] Strong business, but trading at an expensive premium.";
      sentimentColor = '#d93025';
    } else if (pe > 30 && roce < 10) {
      verdict = "[High Risk] Overvalued with poor capital efficiency.";
      sentimentColor = '#d93025';
    } else if (pe < 25 && roce > 15) {
      verdict = "[Solid] Great fundamentals at a reasonable price.";
      sentimentColor = isDark ? '#81c995' : '#188038';
    } else {
      verdict = "[Average] Standard fundamentals. Monitor for growth catalysts.";
      sentimentColor = '#fbbc04';
    }

    return `<div style="background:${bg}; border:${border}; padding:12px; border-radius:8px; margin-top:12px; font-size:13px;">
      <span style="color:${labelColor}; font-weight:600;">AI Verdict:</span> <span style="color:${sentimentColor}; font-weight:500;">${verdict}</span>
    </div>`;
  }

  // --- Search Logic ---
  btnSearch.addEventListener('click', async () => {
    const ticker = inputSearch.value.trim().toUpperCase();
    if (!ticker) return;
    
    resultsSearch.innerHTML = '<div class="screener-loading">Scraping data...</div>';
    
    try {
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'FORCE_SYNC', ticker: ticker }, resolve);
      });
      // The background script just synced, now we read from cache
      chrome.storage.local.get(['cachedData'], (res) => {
        const data = (res.cachedData || {})[ticker];
        if (data && data.success) {
           const isDark = document.body.classList.contains('dark-mode');
           const linkColor = isDark ? '#81c995' : '#188038';
           const labelColor = isDark ? '#9aa0a6' : '#5f6368';
           const valueColor = isDark ? '#e8eaed' : '#202124';
           const rowEven = isDark ? '#303134' : '#f8f9fa';
           const rowOdd = isDark ? '#202124' : '#ffffff';
           const borderColor = isDark ? '#3c4043' : '#e8eaed';
           const tableBorder = isDark ? '#3c4043' : '#dadce0';

           let html = `<h3 style="margin:0 0 4px 0;"><a href="https://www.screener.in/company/${ticker}/" target="_blank" style="color:${linkColor}; text-decoration:none;">${data.companyName}</a></h3>`;
           html += generateVerdict(data.ratios);

           // Add to Watchlist button
           html += `<button id="btn-search-add-wl" data-ticker="${ticker}" style="margin-top:12px; width:100%; padding:10px; border-radius:8px; border:1px solid ${tableBorder}; cursor:pointer; font-weight:600; font-size:14px; background:${isDark ? '#188038' : '#188038'}; color:#fff;">+ Add to Watchlist</button>`;

           html += `<div style="width:100%; overflow-x:auto; margin-top:16px; border:1px solid ${tableBorder}; border-radius:8px;">`;
           html += `<table style="width:100%; border-collapse:collapse; overflow:hidden; font-size:14px; font-family:Roboto,sans-serif;">`;
           let i = 0;
           for (const [k, v] of Object.entries(data.ratios)) {
             const bg = i % 2 === 0 ? rowEven : rowOdd;
             html += `<tr style="background:${bg};">
               <td style="padding:12px 16px; color:${labelColor}; font-weight:500; border-bottom:1px solid ${borderColor}; white-space:nowrap;">${k}</td>
               <td style="padding:12px 16px; color:${valueColor}; font-weight:600; text-align:right; border-bottom:1px solid ${borderColor};">${v}</td>
             </tr>`;
             i++;
           }
           html += `</table></div>`;
           html += `<div style="text-align:right; margin-top:8px;">
             <a href="https://www.screener.in/company/${ticker}/" target="_blank" style="color:#1a73e8; font-size:12px; text-decoration:none; font-weight:500;">&#9881; Customize Parameters on Screener.in</a>
           </div>`;
           if (data.aboutText) html += `<div class="screener-about" style="margin-top:16px;">${data.aboutText}</div>`;
           resultsSearch.innerHTML = html;

           // Wire up the Add to Watchlist button
           const addBtn = document.getElementById('btn-search-add-wl');
           if (addBtn) {
             addBtn.onclick = () => {
               chrome.storage.local.get(['portfolios'], (r) => {
                 const ports = r.portfolios || {};
                 const list = ports[activePortfolio] || [];
                 if (!list.includes(ticker)) {
                   list.push(ticker);
                   ports[activePortfolio] = list;
                   chrome.storage.local.set({ portfolios: ports, screenerWatchlist: list }, () => {
                     addBtn.textContent = 'Added!';
                     addBtn.style.background = '#5f6368';
                     addBtn.disabled = true;
                     chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
                   });
                 } else {
                   addBtn.textContent = 'Already in Watchlist';
                   addBtn.style.background = '#5f6368';
                 }
               });
             };
           }
        } else {
           resultsSearch.innerHTML = '<div class="screener-error">Could not fetch data.</div>';
        }
      });
    } catch (e) {
      resultsSearch.innerHTML = '<div class="screener-error">Error.</div>';
    }
  });

  // --- Watchlist Rendering ---
  function removeTicker(ticker) {
    chrome.storage.local.get(['portfolios'], (res) => {
      const ports = res.portfolios || {};
      const list = ports[activePortfolio] || [];
      ports[activePortfolio] = list.filter(t => t !== ticker);
      
      // Update screenerWatchlist compatibility
      chrome.storage.local.set({ portfolios: ports, screenerWatchlist: ports[activePortfolio] }, () => {
        renderWatchlist();
      });
    });
  }

  btnWlAdd.addEventListener('click', () => {
    const ticker = inputWlAdd.value.trim().toUpperCase();
    if (!ticker) return;
    
    chrome.storage.local.get(['portfolios'], (res) => {
      const ports = res.portfolios || {};
      const list = ports[activePortfolio] || [];
      if (!list.includes(ticker)) {
        list.push(ticker);
        ports[activePortfolio] = list;
        chrome.storage.local.set({ portfolios: ports, screenerWatchlist: list }, () => {
          inputWlAdd.value = '';
          chrome.runtime.sendMessage({ type: 'FORCE_SYNC' });
          renderWatchlist();
        });
      }
    });
  });

  function renderWatchlist() {
    chrome.storage.local.get(['portfolios', 'cachedData', 'priceAlerts'], (res) => {
      const ports = res.portfolios || {};
      const list = ports[activePortfolio] || [];
      const cached = res.cachedData || {};

      if (list.length === 0) {
        wlItemsContainer.innerHTML = '<div style="text-align:center;color:#6c757d;padding:20px;">Watchlist is empty. Add a ticker above!</div>';
        return;
      }
      
      const isDark = document.body.classList.contains('dark-mode');
      const tableBorder = isDark ? '#3c4043' : '#dadce0';
      const headerBg = isDark ? '#303134' : '#f8f9fa';
      const rowEven = isDark ? '#303134' : '#ffffff';
      const rowOdd = isDark ? '#202124' : '#f8f9fa';
      const textColor = isDark ? '#e8eaed' : '#202124';
      const linkColor = isDark ? '#81c995' : '#1a73e8';

      let html = `<div style="width:100%; overflow-x:auto; border:1px solid ${tableBorder}; border-radius:8px;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:right; color:${textColor}; white-space:nowrap;">
          <thead>
            <tr style="background:${headerBg}; border-bottom:1px solid ${tableBorder}; font-weight:600;">
              <td style="text-align:left; padding:10px;">Symbol</td>
              <td style="padding:10px;">Price</td>
              <td style="padding:10px;">P/E</td>
              <td style="padding:10px;">M.Cap</td>
              <td style="padding:10px;">ROCE</td>
              <td style="padding:10px; text-align:center;"></td>
            </tr>
          </thead>
          <tbody>`;

      let idx = 0;
      for (const ticker of list) {
        const data = cached[ticker];
        const bg = (idx % 2 === 0) ? rowEven : rowOdd;
        
        if (!data) {
           html += `<tr style="background:${bg}; border-bottom:1px solid ${tableBorder};">
             <td colspan="6" style="padding:10px; text-align:left;">Waiting for sync (${ticker})...</td>
           </tr>`;
        } else if (!data.success) {
           html += `<tr style="background:${bg}; border-bottom:1px solid ${tableBorder};">
             <td style="padding:10px; text-align:left; color:#d93025;">${ticker}</td>
             <td colspan="4" style="padding:10px; color:#d93025; text-align:left;">Error: ${data.error}</td>
             <td style="padding:10px; text-align:center;"><button class="screener-del-btn" data-ticker="${ticker}" style="background:none;border:none;color:#d93025;cursor:pointer;font-size:16px;" title="Delete ${ticker} from Watchlist">&#128465;</button></td>
           </tr>`;
        } else {
          let pctHtml = '';
          if (data.changePct) {
            const color = data.changeDir === 'up' ? '#188038' : '#d93025';
            const sign = data.changeDir === 'up' ? '&#9650;' : '&#9660;';
            pctHtml = `<span style="color:${color}; font-size:11px; margin-left:4px;">${sign}${data.changePct}</span>`;
          }

          let flashClass = '';
          if (data.flash && (Date.now() - (data.flashTime || 0) < 5000)) {
            flashClass = data.flash === 'up' ? 'screener-flash-up' : 'screener-flash-down';
          }

          html += `
            <tr style="background:${bg}; border-bottom:1px solid ${tableBorder};">
              <td style="text-align:left; padding:10px; font-weight:500;">
                <a href="https://www.screener.in/company/${ticker}/" target="_blank" title="${data.companyName}" style="color:${linkColor}; text-decoration:none;">${ticker}</a>
              </td>
              <td class="${flashClass}" style="padding:10px;">${data.ratios['Current Price']||'-'}<br/>${pctHtml}</td>
              <td style="padding:10px;">${data.ratios['Stock P/E']||'-'}</td>
              <td style="padding:10px;">${data.ratios['Market Cap']||'-'}</td>
              <td style="padding:10px;">${data.ratios['ROCE']||'-'}</td>
              <td style="padding:10px; text-align:center;">
                <button class="screener-del-btn" data-ticker="${ticker}" style="background:none; border:none; color:#d93025; cursor:pointer; font-size:16px; padding:4px 8px; border-radius:4px;" title="Delete ${ticker} from Watchlist">&#128465;</button>
              </td>
            </tr>
          `;
        }
        idx++;
      }
      
      html += `</tbody></table></div>`;
      wlItemsContainer.innerHTML = html;

      const delBtns = wlItemsContainer.querySelectorAll('.screener-del-btn');
      delBtns.forEach(btn => {
        btn.onclick = () => removeTicker(btn.getAttribute('data-ticker'));
        btn.onmouseover = () => { btn.style.backgroundColor = '#f1f3f4'; btn.style.color = '#d93025'; };
        btn.onmouseout = () => { btn.style.backgroundColor = 'transparent'; btn.style.color = '#5f6368'; };
      });
    });
  }

  // --- Default Search Render (Indices) ---
  function renderDefaultSearch() {
    chrome.storage.local.get(['marketIndices'], (res) => {
      const indices = res.marketIndices || {};
      const isDark = document.body.classList.contains('dark-mode');
      const bg = isDark ? '#303134' : '#f1f3f4';
      const border = isDark ? '#3c4043' : '#e8eaed';
      const textColor = isDark ? '#e8eaed' : '#202124';
      const labelColor = isDark ? '#9aa0a6' : '#5f6368';

      if (Object.keys(indices).length === 0) {
        resultsSearch.innerHTML = `<div style="color:${labelColor}; text-align:center; padding:40px 0;">Search for a stock to see quick ratios.</div>`;
        return;
      }

      let html = `<div style="color:${labelColor}; text-align:center; padding-bottom:16px; font-size:13px; font-weight:500;">Market Indices</div>`;
      html += `<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">`;
      
      for (const [name, data] of Object.entries(indices)) {
        const changeVal = parseFloat(data.changePct || '0');
        const changeColor = changeVal > 0 ? '#188038' : (changeVal < 0 ? '#d93025' : labelColor);
        const changeSign = changeVal > 0 ? '&#9650;' : (changeVal < 0 ? '&#9660;' : '');
        const flashClass = data.flash && (Date.now() - (data.flashTime || 0) < 5000) ? (data.flash === 'up' ? 'screener-flash-up' : 'screener-flash-down') : '';

        html += `
          <div style="background:${bg}; border:1px solid ${border}; border-radius:8px; padding:12px; text-align:center;">
            <div style="font-weight:600; color:${textColor}; font-size:14px; margin-bottom:8px;">${name}</div>
            <div class="${flashClass}" style="font-weight:bold; font-size:16px; color:${textColor}; margin-bottom:4px;">&#8377; ${data.price}</div>
            <div style="color:${changeColor}; font-size:12px; font-weight:500;">${changeSign} ${data.changePct}%</div>
          </div>
        `;
      }
      
      html += `</div>`;
      html += `<div style="color:${labelColor}; text-align:center; padding:40px 0 20px 0; font-size:13px;">Search for a stock above to see quick ratios.</div>`;
      
      resultsSearch.innerHTML = html;
    });
  }

  // --- News Render ---
  function renderNews() {
    chrome.storage.local.get(['portfolios'], async (res) => {
      const list = (res.portfolios || {})[activePortfolio] || [];
      if (list.length === 0) {
        newsContainer.innerHTML = '<div style="text-align:center;color:#6c757d;padding:20px;">No stocks in this portfolio to fetch news for.</div>';
        return;
      }
      
      newsContainer.innerHTML = '<div class="screener-loading" style="text-align:center; padding:20px;">Fetching latest financial news...</div>';
      
      let allNewsHtml = '';
      // We will mock fetch news for demonstration, or actually fetch from Yahoo Finance RSS
      for (const ticker of list.slice(0, 3)) { // fetch news for top 3 to be fast
        try {
          const feedRes = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${ticker}.NS`);
          const feedData = await feedRes.json();
          const newsItems = feedData.news || [];
          
          if (newsItems.length > 0) {
            allNewsHtml += `<div style="font-size:12px; font-weight:bold; color:#188038; margin-top:12px; margin-bottom:4px; padding:0 12px;">${ticker} NEWS</div>`;
            newsItems.slice(0,2).forEach(item => {
              allNewsHtml += `
                <div style="padding: 12px; border-bottom: 1px solid #dadce0;">
                  <a href="${item.link}" target="_blank" style="color:#202124; text-decoration:none; font-size:14px; display:block; margin-bottom:4px;">${item.title}</a>
                  <div style="font-size:11px; color:#5f6368;">${item.publisher} â€¢ ${new Date(item.providerPublishTime*1000).toLocaleDateString()}</div>
                </div>
              `;
            });
          }
        } catch (e) {}
      }
      
      if (allNewsHtml === '') {
        newsContainer.innerHTML = '<div style="text-align:center;color:#6c757d;padding:20px;">No recent news found for your portfolio.</div>';
      } else {
        newsContainer.innerHTML = allNewsHtml;
      }
    });
  }

  // Listen for background updates
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'WATCHLIST_UPDATED') {
       if (tabWatchlist.classList.contains('active')) renderWatchlist();
    }
  });

  // --- Autocomplete Logic with Keyboard Navigation ---
  let debounceTimer;
  let activeIndex = -1;

  function highlightItem(container, index) {
    const items = container.querySelectorAll('.screener-suggestion-item');
    items.forEach((el, i) => {
      el.style.backgroundColor = i === index ? '#e8eaed' : '';
      if (document.body.classList.contains('dark-mode')) {
        el.style.backgroundColor = i === index ? '#3c4043' : '';
      }
    });
  }

  async function handleInput(e, suggestionsContainer, inputElement, actionBtn) {
    clearTimeout(debounceTimer);
    activeIndex = -1;
    const query = inputElement.value.trim();
    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      if (query.length === 0 && inputElement === inputSearch) {
        renderDefaultSearch();
      }
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const response = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const results = await response.json();
        if (results && results.length > 0) {
          suggestionsContainer.innerHTML = '';
          results.forEach(item => {
            const div = document.createElement('div');
            div.className = 'screener-suggestion-item';
            div.textContent = item.name;
            div.dataset.ticker = item.url.split('/')[2];
            div.onclick = () => {
              inputElement.value = div.dataset.ticker;
              suggestionsContainer.style.display = 'none';
              activeIndex = -1;
              if (actionBtn) actionBtn.click();
            };
            suggestionsContainer.appendChild(div);
          });
          suggestionsContainer.style.display = 'block';
        }
      } catch (err) {}
    }, 300);
  }

  function handleKeydown(e, suggestionsContainer, inputElement, actionBtn) {
    const items = suggestionsContainer.querySelectorAll('.screener-suggestion-item');
    if (!items.length || suggestionsContainer.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      highlightItem(suggestionsContainer, activeIndex);
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      highlightItem(suggestionsContainer, activeIndex);
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < items.length) {
        items[activeIndex].click();
      } else if (items.length > 0) {
        items[0].click();
      }
    } else if (e.key === 'Escape') {
      suggestionsContainer.style.display = 'none';
      activeIndex = -1;
    }
  }

  inputSearch.addEventListener('input', (e) => handleInput(e, searchSuggestions, inputSearch, btnSearch));
  inputSearch.addEventListener('keydown', (e) => handleKeydown(e, searchSuggestions, inputSearch, btnSearch));

  inputWlAdd.addEventListener('input', (e) => handleInput(e, wlSuggestions, inputWlAdd, btnWlAdd));
  inputWlAdd.addEventListener('keydown', (e) => handleKeydown(e, wlSuggestions, inputWlAdd, btnWlAdd));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.screener-search-container')) {
      if (searchSuggestions) searchSuggestions.style.display = 'none';
      if (wlSuggestions) wlSuggestions.style.display = 'none';
      activeIndex = -1;
    }
  });

});

