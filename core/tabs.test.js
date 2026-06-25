const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isExportableUrl,
  normalizeOpenTabs,
} = require('./tabs');

test('isExportableUrl allows only exportable browser page URLs', () => {
  assert.equal(isExportableUrl('https://example.com/docs'), true);
  assert.equal(isExportableUrl('http://example.com/docs'), true);
  assert.equal(isExportableUrl('file:///C:/tmp/page.html'), true);
  assert.equal(isExportableUrl('chrome://settings/'), false);
  assert.equal(isExportableUrl('edge://settings/'), false);
  assert.equal(isExportableUrl('about:blank'), false);
  assert.equal(isExportableUrl(''), false);
  assert.equal(isExportableUrl(undefined), false);
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
