const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('manifest requests tabs access instead of bookmarks access', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

  assert.deepEqual(manifest.permissions.sort(), ['storage', 'tabs']);
  assert.equal(manifest.permissions.includes('bookmarks'), false);
});

test('manifest keeps the extension isolated from visited pages', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.permissions.includes('scripting'), false);
  assert.equal(manifest.permissions.includes('activeTab'), false);
});

test('popup markup wires the tab exporter UI and scripts', () => {
  const html = fs.readFileSync('popup.html', 'utf8');
  const scripts = Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g))
    .map((match) => match[1]);

  assert.match(html, /Browser Bookmarks Exporter/);
  assert.match(html, /id="tabsCount"/);
  assert.match(html, /id="closeAfterExport"/);
  assert.match(html, /id="exportTabBtn"/);
  assert.match(html, /id="importTabBtn"/);
  assert.match(html, /id="importText"/);
  assert.match(html, /id="importBtn"/);
  assert.match(html, /name="format" value="json"/);
  assert.match(html, /<link rel="stylesheet" href="popup\/popup\.css">/);
  assert.doesNotMatch(html, /<style>/);
  assert.deepEqual(scripts, [
    'core/tabs.js',
    'core/export-file.js',
    'core/import-file.js',
    'browser/chromium-tabs.js',
    'browser/chromium-storage.js',
    'browser/file-save-strategies.js',
    'popup/messages.js',
    'popup/dom.js',
    'popup/export-flow.js',
    'popup/import-flow.js',
    'popup/popup-controller.js',
    'popup.js',
  ]);
  assert.doesNotMatch(html, /deleteAfterExport|Экспорт закладок/);
  assert.doesNotMatch(html, /popup-core\.js/);
});
