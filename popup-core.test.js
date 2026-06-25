const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildExportFile,
  fetchOpenTabs,
  normalizeOpenTabs,
} = require('./popup-core');

test('fetchOpenTabs requests currently opened tabs from the active window', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      return [
        { id: 10, title: 'Docs', url: 'https://example.com/docs' },
        { id: 11, title: 'New tab', url: 'chrome://newtab/' },
      ];
    },
  };

  const links = await fetchOpenTabs(tabsApi);

  assert.deepEqual(queryCalls, [{ currentWindow: true }]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
  ]);
});

test('normalizeOpenTabs keeps exportable tabs in browser order and skips internal pages', () => {
  const links = normalizeOpenTabs([
    { id: 1, title: 'First', url: 'https://first.test' },
    { id: 2, title: 'Settings', url: 'chrome://settings/' },
    { id: 3, title: '', url: 'https://untitled.test' },
    { id: 4, title: 'Local file', url: 'file:///C:/tmp/page.html' },
    { id: 5, title: 'Missing url' },
  ]);

  assert.deepEqual(links, [
    { id: 1, title: 'First', url: 'https://first.test' },
    { id: 3, title: 'https://untitled.test', url: 'https://untitled.test' },
    { id: 4, title: 'Local file', url: 'file:///C:/tmp/page.html' },
  ]);
});

test('normalizeOpenTabs skips pinned tabs', () => {
  const links = normalizeOpenTabs([
    { id: 1, pinned: true, title: 'Pinned mail', url: 'https://mail.example.com' },
    { id: 2, pinned: false, title: 'Work item', url: 'https://tracker.example.com/task' },
    { id: 3, title: 'Regular tab', url: 'https://regular.example.com' },
  ]);

  assert.deepEqual(links, [
    { id: 2, title: 'Work item', url: 'https://tracker.example.com/task' },
    { id: 3, title: 'Regular tab', url: 'https://regular.example.com' },
  ]);
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
  assert.match(file.content, /<p id="empty-search" hidden>Ничего не найдено<\/p>/);
  assert.match(file.content, /addEventListener\('input'/);
  assert.match(file.content, /item\.hidden = !isVisible/);
});
