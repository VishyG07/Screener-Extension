const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
const match = html.match(/<section[^>]*>[\s\S]{0,100}Announcements/i);
if (match) {
    console.log(match[0].substring(0, 150));
} else {
    console.log('Not found');
}
