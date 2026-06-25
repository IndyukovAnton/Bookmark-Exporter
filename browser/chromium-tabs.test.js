const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createTabsRepository,
} = require('./chromium-tabs');

test('tabs repository requests currently opened tabs from the active window', async () => {
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

  const repository = createTabsRepository(tabsApi);
  const links = await repository.listCurrentWindow();

  assert.deepEqual(queryCalls, [{ currentWindow: true }]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
  ]);
});

test('tabs repository requests tabs from the active tab group when groupId is available', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: 42, title: 'Active', url: 'https://example.com/active' }];
      }

      return [
        { id: 10, groupId: 42, title: 'Docs', url: 'https://example.com/docs' },
        { id: 11, groupId: 42, title: 'Tracker', url: 'https://example.com/issues' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi);
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, currentWindow: true },
    { currentWindow: true, groupId: 42 },
  ]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
    { id: 11, title: 'Tracker', url: 'https://example.com/issues' },
  ]);
});

test('tabs repository falls back to current window when tab groups are unavailable', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, title: 'Active', url: 'https://example.com/active' }];
      }

      return [
        { id: 10, title: 'Docs', url: 'https://example.com/docs' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi);
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, currentWindow: true },
    { currentWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
  ]);
});

test('tabs repository closes numeric tab IDs in one browser call', async () => {
  const removeCalls = [];
  const tabsApi = {
    async remove(tabIds) {
      removeCalls.push(tabIds);
    },
  };

  const repository = createTabsRepository(tabsApi);
  const closedTabsCount = await repository.closeByIds([1, undefined, 2, '3', 4]);

  assert.equal(closedTabsCount, 3);
  assert.deepEqual(removeCalls, [[1, 2, 4]]);
});

test('tabs repository falls back to individual closing after bulk browser errors', async () => {
  const removedTabIds = [];
  const removeCalls = [];
  const warningCalls = [];
  const tabsApi = {
    async remove(tabId) {
      removeCalls.push(tabId);

      if (Array.isArray(tabId)) {
        throw new Error('Cannot close tabs in bulk');
      }

      if (tabId === 2) {
        throw new Error('Cannot close tab');
      }

      removedTabIds.push(tabId);
    },
  };
  const logger = {
    warn(...args) {
      warningCalls.push(args);
    },
  };

  const repository = createTabsRepository(tabsApi, { logger });
  const closedTabsCount = await repository.closeByIds([1, undefined, 2, '3', 4]);

  assert.equal(closedTabsCount, 2);
  assert.deepEqual(removeCalls, [[1, 2, 4], 1, 2, 4]);
  assert.deepEqual(removedTabIds, [1, 4]);
  assert.equal(warningCalls.length, 2);
});

test('tabs repository opens imported URLs in inactive tabs and continues after browser errors', async () => {
  const createCalls = [];
  const warningCalls = [];
  const tabsApi = {
    async create(params) {
      createCalls.push(params);

      if (params.url === 'https://example.com/broken') {
        throw new Error('Cannot open tab');
      }
    },
  };
  const logger = {
    warn(...args) {
      warningCalls.push(args);
    },
  };

  const repository = createTabsRepository(tabsApi, { logger });
  const openedTabsCount = await repository.openUrls([
    'https://example.com/docs',
    '',
    'https://example.com/broken',
    'https://example.com/issues',
  ]);

  assert.equal(openedTabsCount, 2);
  assert.deepEqual(createCalls, [
    { active: false, url: 'https://example.com/docs' },
    { active: false, url: 'https://example.com/broken' },
    { active: false, url: 'https://example.com/issues' },
  ]);
  assert.equal(warningCalls.length, 1);
});
