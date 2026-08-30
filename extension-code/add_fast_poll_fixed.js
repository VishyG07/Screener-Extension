const fs = require('fs');
let bg = fs.readFileSync('background.js', 'utf8');

const fastPollFunc = `
// Fast price polling (only hits Yahoo Finance, avoids Screener rate limits)
async function fetchFastPrices() {
  const { screenerWatchlist = [], cachedData = {}, marketIndices = {} } = await chrome.storage.local.get(['screenerWatchlist', 'cachedData', 'marketIndices']);
  if (screenerWatchlist.length === 0 && !marketIndices['NIFTY 50']) return;
  
  let changed = false;
  
  // 1. Fetch indices
  try {
    const res = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^NSEI?interval=1d&range=1d');
    if (res.ok) {
      const d = await res.json();
      const price = d.chart.result[0].meta.regularMarketPrice;
      const prev = d.chart.result[0].meta.chartPreviousClose;
      const diff = price - prev;
      const pct = ((diff/prev)*100).toFixed(2);
      if (marketIndices['NIFTY 50']?.price !== price) {
        marketIndices['NIFTY 50'] = {
          price: price.toLocaleString('en-IN'),
          changeDir: diff >= 0 ? 'up' : 'down',
          changePct: Math.abs(pct) + '%'
        };
        changed = true;
      }
    }
    const res2 = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/^BSESN?interval=1d&range=1d');
    if (res2.ok) {
      const d = await res2.json();
      const price = d.chart.result[0].meta.regularMarketPrice;
      const prev = d.chart.result[0].meta.chartPreviousClose;
      const diff = price - prev;
      const pct = ((diff/prev)*100).toFixed(2);
      if (marketIndices['SENSEX']?.price !== price) {
        marketIndices['SENSEX'] = {
          price: price.toLocaleString('en-IN'),
          changeDir: diff >= 0 ? 'up' : 'down',
          changePct: Math.abs(pct) + '%'
        };
        changed = true;
      }
    }
  } catch(e) {}

  // 2. Fetch watchlist
  for (const ticker of screenerWatchlist) {
    try {
      const yahooRes = await fetch(\`https://query1.finance.yahoo.com/v8/finance/chart/\${ticker}.NS?interval=1m&range=1d\`);
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        const price = yahooData.chart.result[0].meta.regularMarketPrice;
        if (cachedData[ticker] && cachedData[ticker].ratios) {
           const oldStr = cachedData[ticker].ratios['Current Price'];
           const oldPrice = parseFloat(oldStr ? oldStr.toString().replace(/,/g,'') : 0);
           
           if (oldPrice !== price) {
              cachedData[ticker].ratios['Current Price'] = price.toLocaleString('en-IN');
              const prevClose = yahooData.chart.result[0].meta.chartPreviousClose;
              const diff = price - prevClose;
              const pct = ((diff / prevClose) * 100).toFixed(2);
              cachedData[ticker].changeDir = diff >= 0 ? 'up' : 'down';
              cachedData[ticker].changePct = Math.abs(pct) + '%';
              cachedData[ticker].flash = diff >= 0 ? 'up' : 'down';
              cachedData[ticker].flashTime = Date.now();
              changed = true;
           }
        }
      }
    } catch (e) {}
  }
  
  if (changed) {
    await chrome.storage.local.set({ cachedData, marketIndices });
  }
}

// Keep worker alive for fast polling
let fastPollInterval = null;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    if (!fastPollInterval) {
      fetchFastPrices(); // Fetch immediately on first ping
      fastPollInterval = setInterval(fetchFastPrices, 10000); // 10 second ultra-fast poll
    }
    sendResponse({pong: true});
    return true; // Needed to indicate async response
  }
});
`;

if (!bg.includes('fetchFastPrices')) {
  bg = bg + '\n' + fastPollFunc;
  fs.writeFileSync('background.js', bg, 'utf8');
}
