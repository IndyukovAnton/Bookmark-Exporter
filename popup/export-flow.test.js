const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createExportFlow,
} = require('./export-flow');

function createElement(overrides = {}) {
  return {
    checked: false,
    disabled: false,
    textContent: '',
    value: '',
    ...overrides,
  };
}

function createDocumentStub(format) {
  return {
    querySelector(selector) {
      if (selector === 'input[name="format"]:checked') {
        return { value: format };
      }

      if (selector === `input[name="format"][value="${format}"]`) {
        return createElement();
      }

      return null;
    },
  };
}

function createDomStub(calls) {
  return {
    setExportBusy(elements, value) {
      calls.push({ exportBusy: value });
      elements.exportBtn.disabled = value;
      elements.exportBtn.textContent = value ? 'Экспорт...' : 'Экспортировать вкладки';
    },
    setStatus(elements, type, message) {
      calls.push({ status: type, message });
      elements.status.textContent = message;
    },
  };
}

test('export flow exports current group links, saves file and closes exported tabs', async () => {
  const calls = [];
  const savedSettings = [];
  const savedFiles = [];
  const closedIds = [];
  const links = [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
    { id: 11, title: 'Tracker', url: 'https://example.com/issues' },
  ];
  const elements = {
    closeAfterExport: createElement({ checked: true }),
    exportBtn: createElement(),
    filename: createElement({ value: 'daily-tabs' }),
    savePath: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const flow = createExportFlow({
    defaultSettings: {
      filename: 'open-tabs',
      format: 'md',
    },
    documentRef: createDocumentStub('md'),
    dom: createDomStub(calls),
    exportFileCore: {
      buildExportFile(options) {
        return {
          content: options.links.map((link) => link.url).join('\n'),
          exportedLinksCount: options.links.length,
          fullFilename: `${options.filename}.md`,
          mimeType: 'text/markdown',
        };
      },
    },
    fileSaveStrategies: {
      async saveExportFile(file) {
        savedFiles.push(file);

        return { locationName: 'Загрузки' };
      },
    },
    popupMessages: {
      buildExportSuccessMessage({ exportedTabsCount, filename }) {
        return `${exportedTabsCount}:${filename}`;
      },
      getTabsLabel() {
        return 'вкладки';
      },
    },
    settingsRepository: {
      async saveExportSettings(settings) {
        savedSettings.push(settings);
      },
    },
    tabsRepository: {
      async closeByIds(ids) {
        closedIds.push(...ids);

        return ids.length;
      },
      async listCurrentGroup() {
        return links;
      },
    },
    windowRef: {},
  });

  await flow.exportOpenTabs(elements);

  assert.deepEqual(savedSettings, [
    {
      closeAfterExport: true,
      filename: 'daily-tabs',
      format: 'md',
    },
  ]);
  assert.equal(savedFiles[0].fullFilename, 'daily-tabs.md');
  assert.deepEqual(closedIds, [10, 11]);
  assert.equal(elements.status.textContent, '2:daily-tabs.md');
  assert.deepEqual(calls.filter((call) => 'exportBusy' in call), [
    { exportBusy: true },
    { exportBusy: false },
  ]);
});

test('export flow refreshes tabs summary with fallback to current window', async () => {
  const elements = {
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const flow = createExportFlow({
    defaultSettings: {
      filename: 'open-tabs',
      format: 'md',
    },
    documentRef: createDocumentStub('md'),
    dom: createDomStub([]),
    popupMessages: {
      getTabsLabel(count) {
        return count === 1 ? 'вкладка' : 'вкладок';
      },
    },
    settingsRepository: {},
    tabsRepository: {
      async listCurrentWindow() {
        return [{ id: 1, title: 'Docs', url: 'https://example.com/docs' }];
      },
    },
    windowRef: {},
  });

  await flow.refreshTabsSummary(elements);

  assert.equal(elements.tabsCount.textContent, '1');
  assert.equal(elements.tabsLabel.textContent, 'вкладка');
});
