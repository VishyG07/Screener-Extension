const fs = require('fs');
let bg = fs.readFileSync('background.js', 'utf8');

bg = bg.replace(/syncWatchlistData\(\)\.then\(\(\) => sendResponse\(\{ success: true \}\)\);/g, "syncWatchlistData().then(() => sendResponse({ success: true })).catch(() => sendResponse({ success: false }));");

bg = bg.replace(/fetchScreenerData\(message\.ticker\)\.then\(data => \{[\s\S]*?\}\);/g, 
  \etchScreenerData(message.ticker).then(data => {
          chrome.storage.local.get(['cachedData'], (res) => {
            const cachedData = res.cachedData || {};
            cachedData[message.ticker] = data;
            chrome.storage.local.set({ cachedData }, () => {
               sendResponse({ success: true });
            });
          });
        }).catch(() => sendResponse({ success: false }));\);

fs.writeFileSync('background.js', bg, 'utf8');
