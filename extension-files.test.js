const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('manifest requests tabs access instead of bookmarks access', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

  assert.deepEqual(manifest.permissions.sort(), ['storage', 'tabs']);
  assert.equal(manifest.permissions.includes('bookmarks'), false);
});

test('popup markup wires the tab exporter UI and scripts', () => {
  const html = fs.readFileSync('popup.html', 'utf8');

  assert.match(html, /Открытые вкладки/);
  assert.match(html, /id="tabsCount"/);
  assert.match(html, /id="closeAfterExport"/);
  assert.match(html, /<script src="popup-core\.js"><\/script>\s*<script src="popup\.js"><\/script>/);
  assert.doesNotMatch(html, /deleteAfterExport|Экспорт закладок/);
});
