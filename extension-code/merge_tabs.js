const fs = require('fs');
let js = fs.readFileSync('sidepanel.js', 'utf8');

// Replace element lookups
js = js.replace(/const tabSearch = document.getElementById\('tab-search'\);/, "const tabDashboard = document.getElementById('tab-dashboard');");
js = js.replace(/const tabWatchlist = document.getElementById\('tab-watchlist'\);/, "");
js = js.replace(/const viewSearch = document.getElementById\('view-search'\);/, "const viewDashboard = document.getElementById('view-dashboard');");
js = js.replace(/const viewWatchlist = document.getElementById\('view-watchlist'\);/, "");

// Remove old secondary search logic
js = js.replace(/const btnWlAdd = document.getElementById\('btn-wl-add'\);/, "");
js = js.replace(/const inputWlAdd = document.getElementById\('input-wl-add'\);/, "");
js = js.replace(/const wlSuggestions = document.getElementById\('wl-suggestions'\);/, "");

// Replace tab listeners
js = js.replace(/tabSearch\.addEventListener\('click', \(\) => switchTab\(tabSearch, viewSearch\)\);/, "tabDashboard.addEventListener('click', () => switchTab(tabDashboard, viewDashboard));");
js = js.replace(/tabWatchlist\.addEventListener\('click', \(\) => switchTab\(tabWatchlist, viewWatchlist\)\);/, "");

// Remove btnWlAdd listener
js = js.replace(/btnWlAdd\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);/, "");

// Remove inputWlAdd listener
js = js.replace(/inputWlAdd\.addEventListener\('input', debounce\(\(e\) => \{[\s\S]*?wlSuggestions\.style\.display = 'block';[\s\S]*?\}\)\);/, "");

// Remove document click for wlSuggestions
js = js.replace(/if \(!inputWlAdd\.contains\(e\.target\)\) wlSuggestions\.style\.display = 'none';/g, "");

// Write back
fs.writeFileSync('sidepanel.js', js, 'utf8');
