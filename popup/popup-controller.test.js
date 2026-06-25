const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPopupController,
} = require('./popup-controller');

function createElement(overrides = {}) {
  const listeners = {};

  return {
    addEventListener(eventName, listener) {
      listeners[eventName] = listener;
    },
    click() {
      if (listeners.click) {
        listeners.click();
      }
    },
    checked: false,
    className: '',
    disabled: false,
    hidden: true,
    listeners,
    textContent: '',
    value: '',
    ...overrides,
  };
}

function createDocumentStub(elements, querySelector) {
  return {
    getElementById(id) {
      return elements[id];
    },
    querySelector,
  };
}

test('popup controller restores settings, binds events and refreshes tabs summary', async () => {
  const formatInput = createElement();
  const elements = {
    closeAfterExport: createElement(),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement(),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, (selector) => {
    if (selector === 'input[name="format"][value="txt"]') {
      return formatInput;
    }

    return null;
  });
  const controller = createPopupController({
    documentRef,
    settingsRepository: {
      async getSettings() {
        return {
          closeAfterExport: true,
          filename: 'saved-tabs',
          format: 'txt',
          savePathName: 'Work exports',
        };
      },
    },
    tabsRepository: {
      async listCurrentWindow() {
        return [
          { id: 1, title: 'Docs', url: 'https://example.com/docs' },
          { id: 2, title: 'Tracker', url: 'https://example.com/issues' },
        ];
      },
    },
    windowRef: {},
  });

  await controller.init();

  assert.equal(formatInput.checked, true);
  assert.equal(elements.filename.value, 'saved-tabs');
  assert.equal(elements.closeAfterExport.checked, true);
  assert.equal(elements.savePath.value, 'Work exports');
  assert.equal(typeof elements.exportBtn.listeners.click, 'function');
  assert.equal(typeof elements.importBtn.listeners.click, 'function');
  assert.equal(typeof elements.selectPathBtn.listeners.click, 'function');
  assert.equal(typeof elements.exportTabBtn.listeners.click, 'function');
  assert.equal(typeof elements.importTabBtn.listeners.click, 'function');
  assert.equal(elements.tabsCount.textContent, '2');
  assert.equal(elements.tabsLabel.textContent, 'вкладки');
});

test('popup controller restores JSON format from settings', async () => {
  const formatInput = createElement();
  const elements = {
    closeAfterExport: createElement(),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement(),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, (selector) => {
    if (selector === 'input[name="format"][value="json"]') {
      return formatInput;
    }

    return null;
  });
  const controller = createPopupController({
    documentRef,
    settingsRepository: {
      async getSettings() {
        return {
          closeAfterExport: false,
          filename: 'saved-tabs',
          format: 'json',
          savePathName: 'Work exports',
        };
      },
    },
    tabsRepository: {
      async listCurrentWindow() {
        return [];
      },
    },
    windowRef: {},
  });

  await controller.init();

  assert.equal(formatInput.checked, true);
});

test('popup controller switches between export and import tabs', async () => {
  const elements = {
    closeAfterExport: createElement(),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement(),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, () => null);
  const controller = createPopupController({
    documentRef,
    settingsRepository: {
      async getSettings() {
        return {};
      },
    },
    tabsRepository: {
      async listCurrentWindow() {
        return [];
      },
    },
    windowRef: {},
  });

  await controller.init();
  elements.importTabBtn.listeners.click();

  assert.equal(elements.exportPanel.hidden, true);
  assert.equal(elements.importPanel.hidden, false);
  assert.equal(elements.exportTabBtn.className, 'mode-tab');
  assert.equal(elements.importTabBtn.className, 'mode-tab mode-tab--active');

  elements.exportTabBtn.listeners.click();

  assert.equal(elements.exportPanel.hidden, false);
  assert.equal(elements.importPanel.hidden, true);
  assert.equal(elements.exportTabBtn.className, 'mode-tab mode-tab--active');
  assert.equal(elements.importTabBtn.className, 'mode-tab');
});

test('popup controller imports pasted links and opens them through tabs repository', async () => {
  const openedUrls = [];
  const elements = {
    closeAfterExport: createElement({ checked: false }),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement({ value: 'tabs' }),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement({
      value: '- [Docs](https://example.com/docs)\nhttps://example.com/issues',
    }),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, (selector) => {
    if (selector === 'input[name="format"]:checked') {
      return { value: 'md' };
    }

    return null;
  });
  const controller = createPopupController({
    documentRef,
    fileSaveStrategies: {
      supportsDirectoryPicker() {
        return false;
      },
    },
    settingsRepository: {
      async getSettings() {
        return {};
      },
    },
    tabsRepository: {
      async listCurrentWindow() {
        return [];
      },
      async openUrls(urls) {
        openedUrls.push(...urls);

        return urls.length;
      },
    },
    windowRef: {},
  });

  await controller.importLinks(elements);

  assert.deepEqual(openedUrls, [
    'https://example.com/docs',
    'https://example.com/issues',
  ]);
  assert.equal(elements.importBtn.disabled, false);
  assert.equal(elements.importBtn.textContent, 'Открыть ссылки');
  assert.equal(elements.status.className, 'status status--success');
  assert.equal(elements.status.textContent, 'Открыто вкладок: 2.');
});

test('popup controller reads selected import file into textarea', async () => {
  const elements = {
    closeAfterExport: createElement({ checked: false }),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement({ value: 'tabs' }),
    importBtn: createElement(),
    importFile: createElement({
      files: [
        {
          name: 'tabs.json',
          async text() {
            return '[{"title":"Docs","url":"https://example.com/docs"}]';
          },
        },
      ],
    }),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, () => null);
  const controller = createPopupController({
    documentRef,
    settingsRepository: {
      async getSettings() {
        return {};
      },
    },
    tabsRepository: {
      async listCurrentWindow() {
        return [];
      },
      async openUrls() {
        return 0;
      },
    },
    windowRef: {},
  });

  await controller.init();
  await elements.importFile.listeners.change();

  assert.equal(elements.importText.value, '[{"title":"Docs","url":"https://example.com/docs"}]');
  assert.equal(elements.importFileName.textContent, 'tabs.json');
  assert.equal(elements.status.className, 'status status--info');
});

test('popup controller refreshes and exports current tab group when repository supports it', async () => {
  let currentGroupCalls = 0;
  let currentWindowCalls = 0;
  const elements = {
    closeAfterExport: createElement({ checked: false }),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement({ value: 'group-tabs' }),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, (selector) => {
    if (selector === 'input[name="format"]:checked') {
      return { value: 'json' };
    }

    return null;
  });
  const groupLinks = [
    { id: 10, title: 'Group tab', url: 'https://example.com/group' },
  ];
  const controller = createPopupController({
    documentRef,
    fileSaveStrategies: {
      async saveExportFile(exportFile) {
        return {
          locationName: exportFile.fullFilename,
          usedDirectoryPicker: false,
        };
      },
      supportsDirectoryPicker() {
        return false;
      },
    },
    settingsRepository: {
      async getSettings() {
        return {
          closeAfterExport: false,
          filename: 'group-tabs',
          format: 'json',
          savePathName: '',
        };
      },
      async saveExportSettings() {},
    },
    tabsRepository: {
      async listCurrentGroup() {
        currentGroupCalls += 1;

        return groupLinks;
      },
      async listCurrentWindow() {
        currentWindowCalls += 1;

        return [];
      },
    },
    windowRef: {},
  });

  await controller.refreshTabsSummary(elements);
  await controller.exportOpenTabs(elements);

  assert.equal(currentGroupCalls, 3);
  assert.equal(currentWindowCalls, 0);
  assert.equal(elements.tabsCount.textContent, '1');
  assert.equal(elements.status.className, 'status status--success');
});

test('popup controller exports, saves and closes tabs through injected adapters', async () => {
  const savedSettings = [];
  const savedFiles = [];
  const closedIds = [];
  const elements = {
    closeAfterExport: createElement({ checked: true }),
    exportPanel: createElement(),
    exportTabBtn: createElement(),
    exportBtn: createElement(),
    filename: createElement({ value: 'daily-tabs' }),
    importBtn: createElement(),
    importFile: createElement(),
    importFileName: createElement(),
    importPanel: createElement({ hidden: true }),
    importTabBtn: createElement(),
    importText: createElement(),
    savePath: createElement(),
    selectPathBtn: createElement(),
    selectImportFileBtn: createElement(),
    status: createElement(),
    tabsCount: createElement(),
    tabsLabel: createElement(),
  };
  const documentRef = createDocumentStub(elements, (selector) => {
    if (selector === 'input[name="format"]:checked') {
      return { value: 'md' };
    }

    return null;
  });
  const links = [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
    { id: 11, title: 'Tracker', url: 'https://example.com/issues' },
  ];
  const controller = createPopupController({
    documentRef,
    fileSaveStrategies: {
      async saveExportFile(exportFile) {
        savedFiles.push(exportFile);

        return {
          locationName: 'Загрузки',
          usedDirectoryPicker: false,
        };
      },
      supportsDirectoryPicker() {
        return false;
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
      async listCurrentWindow() {
        return links;
      },
    },
    windowRef: {},
  });

  await controller.exportOpenTabs(elements);

  assert.deepEqual(savedSettings, [
    {
      closeAfterExport: true,
      filename: 'daily-tabs',
      format: 'md',
    },
  ]);
  assert.equal(savedFiles.length, 1);
  assert.equal(savedFiles[0].fullFilename, 'daily-tabs.md');
  assert.deepEqual(closedIds, [10, 11]);
  assert.equal(elements.exportBtn.disabled, false);
  assert.equal(elements.exportBtn.textContent, 'Экспортировать вкладки');
  assert.equal(elements.status.className, 'status status--success');
  assert.equal(
    elements.status.textContent,
    'Экспортировано вкладок: 2. Файл "daily-tabs.md" сохранен в Загрузки. Закрыто вкладок: 2.',
  );
});
