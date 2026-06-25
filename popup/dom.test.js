const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getElements,
  setExportBusy,
  setImportBusy,
  setStatus,
  showMode,
} = require('./dom');

function createElement(overrides = {}) {
  const attributes = {};

  return {
    attributes,
    className: '',
    disabled: false,
    hidden: false,
    setAttribute(name, value) {
      attributes[name] = value;
    },
    textContent: '',
    ...overrides,
  };
}

test('getElements reads popup DOM elements by stable ids', () => {
  const calls = [];
  const elements = {
    closeAfterExport: createElement(),
    exportBtn: createElement(),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    filename: createElement(),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement(),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectImportFileBtn: createElement(),
    selectPathBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };

  const result = getElements({
    getElementById(id) {
      calls.push(id);

      return elements[id];
    },
  });

  assert.equal(result.importText, elements.importText);
  assert.equal(result.exportBtn, elements.exportBtn);
  assert.equal(calls.includes('importBtn'), true);
  assert.equal(calls.includes('exportTabBtn'), true);
});

test('showMode switches visible panel and selected tab state', () => {
  const elements = {
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    importPanel: createElement(),
    importTabBtn: createElement(),
  };

  showMode(elements, 'import');

  assert.equal(elements.exportPanel.hidden, true);
  assert.equal(elements.importPanel.hidden, false);
  assert.equal(elements.exportTabBtn.className, 'mode-tab');
  assert.equal(elements.importTabBtn.className, 'mode-tab mode-tab--active');
  assert.equal(elements.exportTabBtn.attributes['aria-selected'], 'false');
  assert.equal(elements.importTabBtn.attributes['aria-selected'], 'true');
});

test('setStatus and busy helpers update focused UI state only', () => {
  const elements = {
    exportBtn: createElement(),
    importBtn: createElement(),
    status: createElement({ hidden: true }),
  };

  setStatus(elements, 'success', 'Готово');
  setExportBusy(elements, true);
  setImportBusy(elements, true);

  assert.equal(elements.status.hidden, false);
  assert.equal(elements.status.className, 'status status--success');
  assert.equal(elements.status.textContent, 'Готово');
  assert.equal(elements.exportBtn.disabled, true);
  assert.equal(elements.exportBtn.textContent, 'Экспорт...');
  assert.equal(elements.importBtn.disabled, true);
  assert.equal(elements.importBtn.textContent, 'Открываю...');
});
