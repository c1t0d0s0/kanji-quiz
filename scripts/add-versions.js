// Adds "?v=<hash of the file>" to the local scripts and stylesheets in an index.html,
// so browsers load a file again as soon as it changes (and keep the cached copy otherwise).
// It also writes the build (a hash of the whole page) into the page and into version.json next
// to it: index.html itself is cached for a while, and the page compares the two to find out
// that a newer build has been published (see the check at the top of index.html).
// Run on the published copy: node scripts/add-versions.js dist/index.html
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
    console.error('usage: node scripts/add-versions.js <index.html>');
    process.exit(1);
}
const dir = path.dirname(file);
const html = fs.readFileSync(file, 'utf8');

// Only plain relative paths: not https://…, //…, data:… or ones that already have a query
const result = html.replace(/(<(?:script|link)\b[^>]*?\b(?:src|href)=")([^"?#:]+\.(?:js|css))(")/g, (match, before, url, after) => {
    const target = path.join(dir, url);
    if (!fs.existsSync(target)) throw new Error(`${url} is referenced in ${file} but does not exist`);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex').slice(0, 10);
    console.log(`${url}?v=${hash}`);
    return `${before}${url}?v=${hash}${after}`;
});

const build = crypto.createHash('sha256').update(result).digest('hex').slice(0, 10);
if (!result.includes('<meta charset="UTF-8">')) throw new Error(`no <meta charset="UTF-8"> in ${file}`);
fs.writeFileSync(file, result.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n    <meta name="build" content="${build}">`));
fs.writeFileSync(path.join(dir, 'version.json'), `${JSON.stringify({ build })}\n`);
console.log(`build ${build}`);
