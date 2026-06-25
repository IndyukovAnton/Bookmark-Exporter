const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createImportFlow,
} = require('./import-flow');

function createElement(overrides = {}) {
  return {
    clickCalls: 0,
    disabled: false,
    files: [],
    textContent: '',
    value: '',
    click() {
      this.clickCalls += 1;
    },
    ...overrides,
  };
}

function createDomStub(calls) {
  return {
    setImportBusy(elements, value) {
      calls.push({ importBusy: value });
      elements.importBtn.disabled = value;
      elements.importBtn.textContent = value ? 'Открываю...' : 'Открыть ссылки';
    },
    setStatus(elements, type, message) {
      calls.push({ status: type, message });
      elements.status.textContent = message;
    },
  };
}

test('import flow reads selected file into textarea', async () => {
  const calls = [];
  const elements = {
    importFile: createElement({
      files: [
        {
          name: 'tabs.json',
          async text() {
            return '[{"url":"https://example.com/docs"}]';
          },
        },
      ],
    }),
    importFileName: createElement(),
    importText: createElement(),
    status: createElement(),
  };
  const flow = createImportFlow({
    dom: createDomStub(calls),
    importFileCore: {
      parseImportedLinks() {
        return [];
      },
    },
    logger: console,
    tabsRepository: {},
  });

  await flow.readImportFile(elements);

  assert.equal(elements.importText.value, '[{"url":"https://example.com/docs"}]');
  assert.equal(elements.importFileName.textContent, 'tabs.json');
  assert.equal(calls.some((call) => call.status === 'info'), true);
});

test('import flow parses text and opens imported URLs', async () => {
  const calls = [];
  const openedUrls = [];
  const elements = {
    importBtn: createElement(),
    importText: createElement({ value: 'links' }),
    status: createElement(),
  };
  const flow = createImportFlow({
    dom: createDomStub(calls),
    importFileCore: {
      parseImportedLinks(value) {
        assert.equal(value, 'links');

        return [
          { title: 'Docs', url: 'https://example.com/docs' },
          { title: 'Tracker', url: 'https://example.com/issues' },
        ];
      },
    },
    logger: console,
    tabsRepository: {
      async openUrls(urls) {
        openedUrls.push(...urls);

        return urls.length;
      },
    },
  });

  await flow.importLinks(elements);

  assert.deepEqual(openedUrls, [
    'https://example.com/docs',
    'https://example.com/issues',
  ]);
  assert.equal(elements.status.textContent, 'Открыто вкладок: 2.');
  assert.deepEqual(calls.filter((call) => 'importBusy' in call), [
    { importBusy: true },
    { importBusy: false },
  ]);
});

test('import flow limits opened URLs using configured import limit', async () => {
  const calls = [];
  const openedUrls = [];
  const savedLimits = [];
  const elements = {
    importBtn: createElement(),
    importLimit: createElement({ value: '2' }),
    importText: createElement({ value: 'links' }),
    status: createElement(),
  };
  const flow = createImportFlow({
    defaultSettings: {
      importLimit: 50,
    },
    dom: createDomStub(calls),
    importFileCore: {
      parseImportedLinks() {
        return [
          { title: 'Docs', url: 'https://example.com/docs' },
          { title: 'Tracker', url: 'https://example.com/issues' },
          { title: 'Mail', url: 'https://example.com/mail' },
        ];
      },
    },
    logger: console,
    settingsRepository: {
      async saveImportLimit(value) {
        savedLimits.push(value);
      },
    },
    tabsRepository: {
      async openUrls(urls) {
        openedUrls.push(...urls);

        return urls.length;
      },
    },
  });

  await flow.importLinks(elements);

  assert.deepEqual(savedLimits, [2]);
  assert.deepEqual(openedUrls, [
    'https://example.com/docs',
    'https://example.com/issues',
  ]);
  assert.equal(elements.status.textContent, 'Открыто вкладок: 2 из 3.');
});

test('import flow delegates file picker click to hidden file input', () => {
  const elements = {
    importFile: createElement(),
  };
  const flow = createImportFlow({
    dom: createDomStub([]),
    importFileCore: {
      parseImportedLinks() {
        return [];
      },
    },
    logger: console,
    tabsRepository: {},
  });

  flow.selectImportFile(elements);

  assert.equal(elements.importFile.clickCalls, 1);
});
