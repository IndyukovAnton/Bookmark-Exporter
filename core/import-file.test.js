const assert = require('node:assert/strict');
const test = require('node:test');

const {
  parseImportedLinks,
} = require('./import-file');

test('parseImportedLinks reads unique URLs from exported JSON', () => {
  const links = parseImportedLinks(JSON.stringify([
    { title: 'Docs', url: 'https://example.com/docs' },
    { title: 'Same title', url: 'https://example.com/api' },
    { title: 'Duplicate URL', url: 'https://example.com/docs' },
    { title: 'Internal page', url: 'chrome://settings/' },
  ]));

  assert.deepEqual(links, [
    { title: 'Docs', url: 'https://example.com/docs' },
    { title: 'Same title', url: 'https://example.com/api' },
  ]);
});

test('parseImportedLinks extracts URLs from markdown, text and html exports', () => {
  const links = parseImportedLinks(`
- [Docs](https://example.com/docs)
Tracker
https://example.com/issues
<a href="https://example.com/html">HTML</a>
chrome://settings/
https://example.com/docs
`);

  assert.deepEqual(links, [
    { title: 'https://example.com/docs', url: 'https://example.com/docs' },
    { title: 'https://example.com/issues', url: 'https://example.com/issues' },
    { title: 'https://example.com/html', url: 'https://example.com/html' },
  ]);
});

test('parseImportedLinks ignores empty and unsupported input', () => {
  assert.deepEqual(parseImportedLinks(''), []);
  assert.deepEqual(parseImportedLinks('not a link'), []);
  assert.deepEqual(parseImportedLinks(undefined), []);
});
