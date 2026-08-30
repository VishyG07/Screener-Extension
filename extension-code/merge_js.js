const fs = require('fs');
let js = fs.readFileSync('sidepanel.js', 'utf8');

js = js.replace(/const tabWatchlist = document\.getElementById\('tab-watchlist'\);\n?/, "");
js = js.replace(/const viewWatchlist = document\.getElementById\('view-watchlist'\);\n?/, "");
js = js.replace(/const btnWlAdd = document\.getElementById\('btn-wl-add'\);\n?/, "");
js = js.replace(/const inputWlAdd = document\.getElementById\('input-wl-add'\);\n?/, "");
js = js.replace(/const wlSuggestions = document\.getElementById\('wl-suggestions'\);\n?/, "");

js = js.replace(/tabWatchlist\.addEventListener\('click', \(\) => switchTab\(tabWatchlist, viewWatchlist\)\);\n?/, "");

// Remove btnWlAdd click listener safely
js = js.replace(/btnWlAdd\.addEventListener\('click', \(\) => \{[\s\S]*?\}\);\n?/, "");

// Remove inputWlAdd input listener safely
js = js.replace(/inputWlAdd\.addEventListener\('input', debounce\(\(e\) => \{[\s\S]*?\}\)\);\n?/, "");

// Remove wlSuggestions body click listener
js = js.replace(/if \(!inputWlAdd\.contains\(e\.target\)\) wlSuggestions\.style\.display = 'none';\n?/, "");

// Fix rendering to always check tabSearch instead of tabWatchlist
js = js.replace(/if \(tabWatchlist\.classList\.contains\('active'\)\) renderWatchlist\(\);/g, "if (tabSearch.classList.contains('active')) renderWatchlist();");

// Change the main search 'Add to Watchlist' logic: since they are in the same tab, rendering should just refresh the list below
// It already calls renderWatchlist() in the success callback.

fs.writeFileSync('sidepanel.js', js, 'utf8');
