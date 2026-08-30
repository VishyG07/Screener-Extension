const fs = require('fs');
let js = fs.readFileSync('sidepanel.js', 'utf8');

js = js.replace(/\[viewSearch, viewWatchlist, viewNews\]/g, "[viewSearch, viewNews]");

fs.writeFileSync('sidepanel.js', js, 'utf8');
