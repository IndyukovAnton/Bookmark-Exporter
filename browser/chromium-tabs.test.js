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

test('tabs repository closes numeric tab IDs and continues after browser errors', async () => {
  const removedTabIds = [];
  const warningCalls = [];
  const tabsApi = {
    async remove(tabId) {
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
  assert.deepEqual(removedTabIds, [1, 4]);
  assert.equal(warningCalls.length, 1);
});
