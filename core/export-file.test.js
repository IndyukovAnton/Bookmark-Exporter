const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildExportFile,
  sanitizeFilename,
} = require('./export-file');

test('sanitizeFilename removes forbidden filename characters and keeps a default fallback', () => {
  assert.equal(sanitizeFilename('tabs<>:"/\\|?*'), 'tabs');
  assert.equal(sanitizeFilename('  sprint   links  '), 'sprint links');
  assert.equal(sanitizeFilename(''), 'open-tabs');
});

test('buildExportFile creates escaped HTML for opened tabs', () => {
  const file = buildExportFile({
    filename: 'tabs<>:"/\\|?*',
    format: 'html',
    links: [
      {
        title: 'A <dangerous> "title"',
        url: 'https://example.com/?q=1&x=<tag>',
      },
    ],
  });

  assert.equal(file.fullFilename, 'tabs.html');
  assert.equal(file.mimeType, 'text/html');
  assert.match(file.content, /<h1>Открытые вкладки<\/h1>/);
  assert.match(file.content, /A &lt;dangerous&gt; &quot;title&quot;/);
  assert.match(file.content, /https:\/\/example.com\/\?q=1&amp;x=&lt;tag&gt;/);
});

test('buildExportFile adds client-side search to HTML export', () => {
  const file = buildExportFile({
    filename: 'tabs',
    format: 'html',
    links: [
      { title: 'Docs', url: 'https://example.com/docs' },
      { title: 'Tracker', url: 'https://example.com/issues' },
    ],
  });

  assert.match(file.content, /<label for="tabs-search">Поиск по вкладкам<\/label>/);
  assert.match(file.content, /<input id="tabs-search" type="search"/);
  assert.match(file.content, /<p id="search-summary" aria-live="polite">Найдено: 2<\/p>/);
  assert.match(file.content, /\.hidden \{ display: none; \}/);
  assert.match(file.content, /<p id="empty-search" class="hidden">Ничего не найдено<\/p>/);
  assert.match(file.content, /addEventListener\('input'/);
  assert.match(file.content, /const hasQuery = query !== '';/);
  assert.match(file.content, /const isVisible = !hasQuery \|\| item\.textContent\.toLowerCase\(\)\.includes\(query\);/);
  assert.match(file.content, /item\.classList\.toggle\('hidden', !isVisible\);/);
  assert.match(file.content, /emptySearch\.classList\.toggle\('hidden', !hasQuery \|\| visibleCount > 0\);/);
});

test('buildExportFile isolates exported links from opener access', () => {
  const file = buildExportFile({
    filename: 'tabs',
    format: 'html',
    links: [
      { title: 'Docs', url: 'https://example.com/docs' },
    ],
  });

  assert.match(file.content, /target="_blank" rel="noreferrer noopener"/);
});

test('buildExportFile creates markdown and text exports with configured extensions', () => {
  const links = [{ title: 'Docs *API*', url: 'https://example.com/docs' }];

  const markdownFile = buildExportFile({ filename: 'tabs', format: 'md', links });
  const textFile = buildExportFile({ filename: 'tabs', format: 'txt', links });

  assert.equal(markdownFile.fullFilename, 'tabs.md');
  assert.equal(markdownFile.mimeType, 'text/markdown');
  assert.equal(
    markdownFile.content.includes('- [Docs \\*API\\*](https://example.com/docs)'),
    true,
  );

  assert.equal(textFile.fullFilename, 'tabs.txt');
  assert.equal(textFile.mimeType, 'text/plain');
  assert.match(textFile.content, /Docs \*API\*\nhttps:\/\/example.com\/docs/);
});
