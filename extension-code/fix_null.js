const fs = require('fs');
let bg = fs.readFileSync('background.js', 'utf8');

// Fix 1: Don't save null indices
bg = bg.replace(/marketIndices: indices/g, 'marketIndices: indices || oldIndices || {}');

// Fix 2: Protect against null marketIndices in fetchFastPrices
bg = bg.replace(/const \{ screenerWatchlist = \[\], cachedData = \{\}, marketIndices = \{\} \} = await chrome.storage.local.get\(\['screenerWatchlist', 'cachedData', 'marketIndices'\]\);/g, 
  "const data = await chrome.storage.local.get(['screenerWatchlist', 'cachedData', 'marketIndices']);\n  const screenerWatchlist = data.screenerWatchlist || [];\n  const cachedData = data.cachedData || {};\n  const marketIndices = data.marketIndices || {};");

fs.writeFileSync('background.js', bg, 'utf8');
