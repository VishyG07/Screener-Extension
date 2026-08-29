const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
const peersStart = html.indexOf('<section id="peers"');
const peersEnd = html.indexOf('</section>', peersStart);
if (peersStart > -1) {
    const peersHtml = html.substring(peersStart, peersEnd);
    console.log(peersHtml.substring(0, 500));
}
