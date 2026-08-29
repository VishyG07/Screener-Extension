const fs = require('fs');
let content = fs.readFileSync('sidepanel.js', 'utf8');
content = content.replace(/fetch\(\\https:.*?\.NS\?range=7d&interval=1d\\\)/g, 'fetch(https://query1.finance.yahoo.com/v8/finance/chart/{ticker}.NS?range=7d&interval=1d)');
content = content.replace(/return \\\<svg/g, 'return <svg');
content = content.replace(/\\\/, '').replace(/\\\/, '');
fs.writeFileSync('sidepanel.js', content, 'utf8');

content = fs.readFileSync('floating_widget.js', 'utf8');
content = content.replace(/fetch\(\\https:.*?\.NS\?range=7d&interval=1d\\\)/g, 'fetch(https://query1.finance.yahoo.com/v8/finance/chart/{ticker}.NS?range=7d&interval=1d)');
content = content.replace(/return \\\<svg/g, 'return <svg');
content = content.replace(/\\\/, '').replace(/\\\/, '');
fs.writeFileSync('floating_widget.js', content, 'utf8');
