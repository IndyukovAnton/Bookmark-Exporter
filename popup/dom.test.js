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
    ownerDocument: {
      createElement(tagName) {
        return createElement({ tagName });
      },
    },
    replaceChildren(...children) {
      this.children = children;
    },
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
    copyDiagnosticsBtn: createElement(),
    exportBtn: createElement(),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    filename: createElement(),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importLimit: createElement(),
    importPanel: createElement(),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectImportFileBtn: createElement(),
    selectPathBtn: createElement(),
    settingsPanel: createElement(),
    settingsTabBtn: createElement(),
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
  assert.equal(calls.includes('settingsTabBtn'), true);
  assert.equal(result.importLimit, elements.importLimit);
  assert.equal(result.selectPathBtn, elements.selectPathBtn);
  assert.equal(result.copyDiagnosticsBtn, elements.copyDiagnosticsBtn);
  assert.equal(calls.includes('exportGroupSelect'), false);
  assert.equal(calls.includes('exportGroupHint'), false);
});

test('showMode switches visible panel and selected tab state across three modes', () => {
  const elements = {
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    importPanel: createElement(),
    importTabBtn: createElement(),
    settingsPanel: createElement(),
    settingsTabBtn: createElement(),
  };

  showMode(elements, 'settings');

  assert.equal(elements.exportPanel.hidden, true);
  assert.equal(elements.importPanel.hidden, true);
  assert.equal(elements.settingsPanel.hidden, false);
  assert.equal(elements.exportTabBtn.className, 'mode-tab');
  assert.equal(elements.importTabBtn.className, 'mode-tab');
  assert.equal(elements.settingsTabBtn.className, 'mode-tab mode-tab--active');
  assert.equal(elements.exportTabBtn.attributes['aria-selected'], 'false');
  assert.equal(elements.importTabBtn.attributes['aria-selected'], 'false');
  assert.equal(elements.settingsTabBtn.attributes['aria-selected'], 'true');
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
