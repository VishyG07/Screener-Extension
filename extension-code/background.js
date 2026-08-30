// Open side panel on action icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// Fetch helper
function roundStringValue(str) {
  return str.replace(/[\d,\.]+/g, (match) => {
    if (match === '.') return match;
    const num = parseFloat(match.replace(/,/g, ''));
    if (isNaN(num)) return match;
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
}

async function fetchScreenerData(ticker) {
  try {
    let response = await fetch(`https://www.screener.in/company/${ticker}/consolidated/`);
    if (!response.ok) {
      response = await fetch(`https://www.screener.in/company/${ticker}/`);
      if (!response.ok) throw new Error('Not found');
    }
    const htmlText = await response.text();
    
    // We must use a simple regex or a lightweight parser because DOMParser is not available in Service Workers
    const extractName = htmlText.match(/<h1[^>]*>([^<]+)<\/h1>/);
    const companyName = extractName ? extractName[1].trim() : ticker;

    const ratios = {};
    
    // Look for top-ratios block
    const ratiosMatch = htmlText.match(/<ul id="top-ratios">([\s\S]*?)<\/ul>/);
    if (ratiosMatch) {
      const listHtml = ratiosMatch[1];
      const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
      
      let match;
      while ((match = liRegex.exec(listHtml)) !== null) {
        const liHtml = match[1];
        const nameMatch = liHtml.match(/<span class="name">\s*([^<]+)\s*<\/span>/);
        if (nameMatch) {
          let name = nameMatch[1].trim();
          let afterName = liHtml.substring(nameMatch.index + nameMatch[0].length);
          let valueStr = afterName.replace(/<[^>]+>/g, '').trim().replace(/\s+/g, ' ');
          ratios[name] = roundStringValue(valueStr);
        }
      }
    }

    // Extract daily percentage change
    const pctMatch = htmlText.match(/class="[^"]*\b(up|down)\b[^"]*">\s*<i[^>]+><\/i>\s*([-+\d\.]+%)\s*<\/span>/);
    let changeDir = '';
    let changePct = '';
    if (pctMatch) {
      changeDir = pctMatch[1]; // 'up' or 'down'
      changePct = roundStringValue(pctMatch[2]);
    }

    const aboutMatch = htmlText.match(/class="sub show-more-box about"[^>]*>([\s\S]*?)<\/div>/);
    let aboutText = '';
    if (aboutMatch) {
      aboutText = aboutMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Fetch Sparkline data (last 7 days closing prices) from Yahoo Finance
    let sparkline = [];
    try {
      const yahooRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.NS?interval=1d&range=7d`);
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const quotes = yahooData.chart.result[0].indicators.quote[0];
        // filter out nulls
        sparkline = quotes.close.filter(p => p !== null).map(p => parseFloat(p.toFixed(2)));
      }
    } catch (e) {}

    return { success: true, ticker, companyName, ratios, aboutText, changeDir, changePct, sparkline };
  } catch (err) {
    return { success: false, ticker, error: err.message };
  }
}

async function fetchIndices() {
  try {
    const indices = {};
    const formatPrice = (num) => Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    const niftyRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?interval=1d');
    if (niftyRes.ok) {
      const data = await niftyRes.json();
      const meta = data.chart.result[0].meta;
      indices['NIFTY 50'] = {
        price: formatPrice(meta.regularMarketPrice),
        changePct: Number(meta.regularMarketChangePercent).toFixed(2)
      };
    }
    const sensexRes = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^BSESN?interval=1d');
    if (sensexRes.ok) {
      const data = await sensexRes.json();
      const meta = data.chart.result[0].meta;
      indices['SENSEX'] = {
        price: formatPrice(meta.regularMarketPrice),
        changePct: Number(meta.regularMarketChangePercent).toFixed(2)
      };
    }
    return indices;
  } catch (err) {
    console.error('Error fetching indices', err);
    return null;
  }
}

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('checkAlerts', { periodInMinutes: 5 });
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('checkAlerts', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAlerts') {
    checkPriceAlerts();
  }
  if (alarm.name === 'syncWatchlist') {
    syncWatchlistData();
  }
});

async function checkPriceAlerts() {
  chrome.storage.local.get(['alerts', 'portfolios'], async (res) => {
    const alerts = res.alerts || {};
    // Collect all tickers that have active alerts
    const activeTickers = Object.keys(alerts).filter(t => alerts[t].above || alerts[t].below);
    if (activeTickers.length === 0) return;

    for (const ticker of activeTickers) {
      try {
        const fetchRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.NS?range=1d&interval=1d`);
        const data = await fetchRes.json();
        const price = data.chart.result[0].meta.regularMarketPrice;
        
        const threshold = alerts[ticker];
        if (threshold.above && price > threshold.above) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon_128.png',
            title: 'Price Alert Triggered! 📈',
            message: `${ticker} has crossed above ₹${threshold.above} (Current: ₹${price})`
          });
          // Remove the alert once triggered
          delete alerts[ticker].above;
        }
        if (threshold.below && price < threshold.below) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon_128.png',
            title: 'Price Alert Triggered! 📉',
            message: `${ticker} has dropped below ₹${threshold.below} (Current: ₹${price})`
          });
          delete alerts[ticker].below;
        }
      } catch (e) {}
    }
    chrome.storage.local.set({ alerts });
  });
}

// Background syncing logic
async function syncWatchlistData() {
  const { portfolios = {}, screenerWatchlist = [], priceAlerts = {}, cachedData: oldCachedData = {}, marketIndices: oldIndices = {} } = await chrome.storage.local.get(['portfolios', 'screenerWatchlist', 'priceAlerts', 'cachedData', 'marketIndices']);
  
  // Combine screenerWatchlist and all portfolio lists into one master list of unique tickers to fetch
  let allTickers = [...screenerWatchlist];
  for (const list of Object.values(portfolios)) {
    allTickers.push(...list);
  }
  allTickers = [...new Set(allTickers)]; // remove duplicates
  
  const cachedData = {};
  for (const ticker of allTickers) {
    const data = await fetchScreenerData(ticker);
    
    // Compare price for flash animation
    const oldData = oldCachedData[ticker];
    if (oldData && oldData.success && data.success) {
       const oldPrice = parseFloat((oldData.ratios['Current Price'] || '0').replace(/,/g, ''));
       const newPrice = parseFloat((data.ratios['Current Price'] || '0').replace(/,/g, ''));
       if (newPrice > oldPrice) {
           data.flash = 'up';
           data.flashTime = Date.now();
       } else if (newPrice < oldPrice) {
           data.flash = 'down';
           data.flashTime = Date.now();
       }
    }
    
    cachedData[ticker] = data;

    // Check Price Alerts
    if (priceAlerts[ticker] && data.success) {
      const priceStr = data.ratios['Current Price'];
      if (priceStr) {
        const currentPrice = parseFloat(priceStr.replace(/,/g, ''));
        const alert = priceAlerts[ticker];
        
        let triggered = false;
        if (alert.condition === 'above' && currentPrice >= alert.target) triggered = true;
        if (alert.condition === 'below' && currentPrice <= alert.target) triggered = true;

        if (triggered && !alert.notified) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'chrome://favicon/https://www.screener.in',
            title: 'Screener Price Alert',
            message: `${ticker} has crossed your target of ${alert.target} (Current: ${currentPrice})`
          });
          priceAlerts[ticker].notified = true;
        } else if (!triggered) {
          // reset if it goes out of threshold
          priceAlerts[ticker].notified = false;
        }
      }
    }

    // Sleep slightly to avoid spamming
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const indices = await fetchIndices();
  if (indices) {
    for (const key of ['SENSEX', 'NIFTY 50']) {
      if (indices[key] && oldIndices[key]) {
        const oldPrice = parseFloat((oldIndices[key].price || '0').replace(/,/g, ''));
        const newPrice = parseFloat((indices[key].price || '0').replace(/,/g, ''));
        if (newPrice > oldPrice) {
            indices[key].flash = 'up';
            indices[key].flashTime = Date.now();
        } else if (newPrice < oldPrice) {
            indices[key].flash = 'down';
            indices[key].flashTime = Date.now();
        }
      }
    }
  }

  await chrome.storage.local.set({ cachedData, marketIndices: indices || oldIndices || {}, priceAlerts, lastSync: Date.now() });
  
  // Notify tabs that data was updated so they can refresh
  chrome.runtime.sendMessage({ type: 'WATCHLIST_UPDATED' }).catch(() => {});
}

// Set up alarm to sync every 5 minutes
chrome.alarms.create('syncWatchlist', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'syncWatchlist') {
    syncWatchlistData();
  }
});

// Run once on startup
syncWatchlistData();

// Listen for forced syncs from UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FORCE_SYNC') {
    if (message.ticker) {
      fetchScreenerData(message.ticker).then(data => {
        chrome.storage.local.get(['cachedData'], (res) => {
          const cachedData = res.cachedData || {};
          cachedData[message.ticker] = data;
          chrome.storage.local.set({ cachedData }, () => {
             sendResponse({ success: true });
          });
        });
      }).catch(err => {
        sendResponse({ success: false, error: err.message });
      });
    } else {
      syncWatchlistData()
        .then(() => sendResponse({ success: true }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    }
    return true;
  }

  if (message.type === 'SEARCH_COMPANY') {
    fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(message.query)}`)
      .then(res => res.ok ? res.json() : [])
      .then(results => sendResponse(results))
      .catch(() => sendResponse([]));
    return true;
  }

  if (message.type === 'CORPORATE_ACTIONS') {
    const { symbol } = message;
    fetch(`https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=${encodeURIComponent(symbol)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/'
      }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        // Return top 10 most recent, with just the key fields
        const trimmed = (Array.isArray(data) ? data : []).slice(0, 10).map(a => ({
          symbol: a.symbol,
          subject: a.subject,
          exDate: a.exDate,
          recDate: a.recDate,
          series: a.series
        }));
        sendResponse({ success: true, data: trimmed });
      })
      .catch(err => sendResponse({ success: false, data: [], error: err.message }));
    return true;
  }
});

// --- Context Menu Logic ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "addToScreener",
    title: 'Add "%s" to Screener Watchlist',
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "addToScreener") {
    const query = info.selectionText.trim();
    if (!query) return;
    try {
      const res = await fetch(`https://www.screener.in/api/company/search/?q=${encodeURIComponent(query)}`);
      const results = await res.json();
      if (results && results.length > 0) {
        const parts = results[0].url.split('/');
        const ticker = parts[2];
        const { screenerWatchlist = [] } = await chrome.storage.local.get(['screenerWatchlist']);
        if (!screenerWatchlist.includes(ticker)) {
          screenerWatchlist.push(ticker);
          await chrome.storage.local.set({ screenerWatchlist });
          syncWatchlistData(); // fetch new data immediately
          // Notify user via a silent push notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'chrome://favicon/https://www.screener.in',
            title: 'Screener Watchlist',
            message: `Added ${ticker} to your watchlist!`,
            silent: true
          });
        }
      }
    } catch(err) {
      console.error('Context menu search failed', err);
    }
  }
});


// Fast price polling (only hits Yahoo Finance, avoids Screener rate limits)
async function fetchFastPrices() {
  const data = await chrome.storage.local.get(['screenerWatchlist', 'cachedData', 'marketIndices']);
  const screenerWatchlist = data.screenerWatchlist || [];
  const cachedData = data.cachedData || {};
  const marketIndices = data.marketIndices || {};
  
  // Always include indices
  const symbolsToFetch = ['^NSEI', '^BSESN'];
  screenerWatchlist.forEach(t => symbolsToFetch.push(t + '.NS'));
  
  let changed = false;
  
  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbolsToFetch.join(',')}&interval=1m&range=1d`);
    if (res.ok) {
      const sparkData = await res.json();
      
      // Process NIFTY 50
      if (sparkData['^NSEI']) {
        const d = sparkData['^NSEI'];
        const prices = d.close || [];
        // Find last non-null price
        let price = null;
        for (let i = prices.length - 1; i >= 0; i--) {
            if (prices[i] !== null && prices[i] !== undefined) { price = prices[i]; break; }
        }
        if (price !== null) {
            const prev = d.previousClose;
            const diff = price - prev;
            const pct = ((diff/prev)*100).toFixed(2);
            if (marketIndices['NIFTY 50']?.price !== price.toLocaleString('en-IN')) {
              marketIndices['NIFTY 50'] = {
                price: price.toLocaleString('en-IN'),
                changeDir: diff >= 0 ? 'up' : 'down',
                changePct: Math.abs(pct) + '%'
              };
              changed = true;
            }
        }
      }
      
      // Process SENSEX
      if (sparkData['^BSESN']) {
        const d = sparkData['^BSESN'];
        const prices = d.close || [];
        let price = null;
        for (let i = prices.length - 1; i >= 0; i--) {
            if (prices[i] !== null && prices[i] !== undefined) { price = prices[i]; break; }
        }
        if (price !== null) {
            const prev = d.previousClose;
            const diff = price - prev;
            const pct = ((diff/prev)*100).toFixed(2);
            if (marketIndices['SENSEX']?.price !== price.toLocaleString('en-IN')) {
              marketIndices['SENSEX'] = {
                price: price.toLocaleString('en-IN'),
                changeDir: diff >= 0 ? 'up' : 'down',
                changePct: Math.abs(pct) + '%'
              };
              changed = true;
            }
        }
      }
      
      // Process Watchlist
      for (const ticker of screenerWatchlist) {
        const key = ticker + '.NS';
        if (sparkData[key]) {
          const d = sparkData[key];
          const prices = d.close || [];
          let price = null;
          for (let i = prices.length - 1; i >= 0; i--) {
              if (prices[i] !== null && prices[i] !== undefined) { price = prices[i]; break; }
          }
          if (price !== null) {
              const prev = d.previousClose;
              const diff = price - prev;
              const pct = ((diff/prev)*100).toFixed(2);
              
              if (!cachedData[ticker]) cachedData[ticker] = { ratios: {} };
              if (!cachedData[ticker].ratios) cachedData[ticker].ratios = {};
              
              const currentStr = cachedData[ticker].ratios['Current Price'];
              if (currentStr !== '₹ ' + price.toFixed(2)) {
                cachedData[ticker].ratios['Current Price'] = '₹ ' + price.toFixed(2);
                cachedData[ticker].changePct = Math.abs(pct) + '%';
                cachedData[ticker].changeDir = diff >= 0 ? 'up' : 'down';
                changed = true;
              }
              
              // Only update sparkline occasionally to save storage space? 
              // The spark endpoint gives us 1m granularity, which is too dense for the sparkline (390 points).
              // We'll leave the sparkline fetching to the 10-minute syncWatchlistData interval or just skip it here.
          }
        }
      }
    }
  } catch(e) {}
  
  if (changed) {
    await chrome.storage.local.set({ cachedData, marketIndices });
    // Notify all UI contexts
    chrome.runtime.sendMessage({ type: 'WATCHLIST_UPDATED' }).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    if (!fastPollInterval) {
      fetchFastPrices(); // Fetch immediately on first ping
      fastPollInterval = setInterval(fetchFastPrices, 1000); // 1-second ultra-fast batched poll // 10 second ultra-fast poll
    }
    sendResponse({pong: true});
    return true; // Needed to indicate async response
  }
});
