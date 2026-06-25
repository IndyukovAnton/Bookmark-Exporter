const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildExportSuccessMessage,
  getTabsLabel,
} = require('./messages');

test('getTabsLabel returns Russian plural forms for tab counts', () => {
  assert.equal(getTabsLabel(0), 'вкладок');
  assert.equal(getTabsLabel(1), 'вкладка');
  assert.equal(getTabsLabel(2), 'вкладки');
  assert.equal(getTabsLabel(5), 'вкладок');
  assert.equal(getTabsLabel(11), 'вкладок');
  assert.equal(getTabsLabel(21), 'вкладка');
});

test('buildExportSuccessMessage includes exported count, filename, location and optional closed count', () => {
  assert.equal(
    buildExportSuccessMessage({
      closedTabsCount: 2,
      closeAfterExport: true,
      exportedTabsCount: 3,
      filename: 'tabs.md',
      locationName: 'Work exports',
    }),
    'Экспортировано вкладок: 3. Файл "tabs.md" сохранен в папку "Work exports". Закрыто вкладок: 2.',
  );

  assert.equal(
    buildExportSuccessMessage({
      closeAfterExport: false,
      exportedTabsCount: 1,
      filename: 'tabs.txt',
      locationName: 'Загрузки',
    }),
    'Экспортировано вкладок: 1. Файл "tabs.txt" сохранен в Загрузки.',
  );
});
