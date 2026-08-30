const fs = require('fs');
let js = fs.readFileSync('sidepanel.js', 'utf8');

js = js.replace(/const response = await fetch\(https:\/\/www\.screener\.in\/api\/company\/search\/\?q=\\$\\{encodeURIComponent\(query\)\\}\);\n\s*if \(\!response\.ok\) return;\n\s*const results = await response\.json\(\);/,
  \const results = await new Promise(resolve => {
            chrome.runtime.sendMessage({ type: 'SEARCH_COMPANY', query: query }, resolve);
          });\);

fs.writeFileSync('sidepanel.js', js, 'utf8');
