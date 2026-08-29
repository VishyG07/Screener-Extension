const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
const idx = html.toLowerCase().indexOf('announcement');
if (idx > -1) {
    console.log(html.substring(idx - 100, idx + 300));
} else {
    console.log('Not found');
}
