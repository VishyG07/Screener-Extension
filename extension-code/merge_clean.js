const fs = require('fs');
let js = fs.readFileSync('sidepanel.js', 'utf8');

js = js.replace(/\[tabSearch, tabWatchlist, tabNews\]/g, "[tabSearch, tabNews]");
js = js.replace(/if \(activeTab === tabWatchlist\) renderWatchlist\(\);/g, "if (activeTab === tabSearch) renderWatchlist();");
js = js.replace(/if \(tabWatchlist\.classList\.contains\('active'\)\) renderWatchlist\(\);/g, "if (tabSearch.classList.contains('active')) renderWatchlist();");

fs.writeFileSync('sidepanel.js', js, 'utf8');
