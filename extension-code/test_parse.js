const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
console.log('Peers:', html.indexOf('<section id="peers"'));
console.log('Announcements:', html.indexOf('<section id="announcements"'));
