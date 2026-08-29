const fs = require('fs');
const html = fs.readFileSync('test.html', 'utf8');
const parser = require('cheerio').load(html);
const docs = parser('section:contains("Announcements")');
console.log("Sections with 'Announcements':", docs.length);
if (docs.length > 0) {
    console.log(docs.eq(0).attr('id'));
}
