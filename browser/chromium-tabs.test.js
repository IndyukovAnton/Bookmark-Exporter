const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectTabsDiagnostics,
  createTabGroupsRepository,
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

  assert.deepEqual(queryCalls, [{ lastFocusedWindow: true }]);
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
    { active: true, lastFocusedWindow: true },
    { currentWindow: true, groupId: 42 },
  ]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
    { id: 11, title: 'Tracker', url: 'https://example.com/issues' },
  ]);
});

test('tabs repository scopes group query to active tab window instead of popup current window', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: 42, windowId: 7, title: 'Active', url: 'https://example.com/active' }];
      }

      return [
        { id: 10, groupId: 42, windowId: 7, title: 'Docs', url: 'https://example.com/docs' },
        { id: 11, groupId: 42, windowId: 7, title: 'Tracker', url: 'https://example.com/issues' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi);
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { groupId: 42, windowId: 7 },
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
    { active: true, lastFocusedWindow: true },
    { lastFocusedWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 10, title: 'Docs', url: 'https://example.com/docs' },
  ]);
});

test('tabs repository uses highlighted tabs as Yandex active context when groupId is unavailable', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' }];
      }

      if (params.highlighted === true) {
        return [
          { id: 100, groupId: -1, highlighted: true, title: 'Active', url: 'https://youtube.com/active' },
          { id: 101, groupId: -1, highlighted: true, title: 'Video', url: 'https://youtube.com/watch?v=1' },
        ];
      }

      return [
        { id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' },
        { id: 101, groupId: -1, title: 'Video', url: 'https://youtube.com/watch?v=1' },
        { id: 200, groupId: -1, title: 'Mail', url: 'https://mail.example.com' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
  });
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { currentWindow: true },
    { highlighted: true, currentWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://youtube.com/active' },
    { id: 101, title: 'Video', url: 'https://youtube.com/watch?v=1' },
  ]);
});

test('tabs repository prefers visible Yandex tabs when inactive groups are hidden', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' }];
      }

      if (params.highlighted === true) {
        return [{ id: 100, groupId: -1, highlighted: true, title: 'Active', url: 'https://youtube.com/active' }];
      }

      return [
        { id: 100, groupId: -1, hidden: false, title: 'Active', url: 'https://youtube.com/active' },
        { id: 101, groupId: -1, hidden: false, title: 'Video', url: 'https://youtube.com/watch?v=1' },
        { id: 200, groupId: -1, hidden: true, title: 'Mail', url: 'https://mail.example.com' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
  });
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { currentWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://youtube.com/active' },
    { id: 101, title: 'Video', url: 'https://youtube.com/watch?v=1' },
  ]);
});

test('tabs repository ignores single visible Yandex tab and keeps looking for active context', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' }];
      }

      if (params.highlighted === true) {
        return [
          { id: 100, groupId: -1, highlighted: true, title: 'Active', url: 'https://youtube.com/active' },
          { id: 101, groupId: -1, highlighted: true, title: 'Video', url: 'https://youtube.com/watch?v=1' },
          { id: 102, groupId: -1, highlighted: true, title: 'Playlist', url: 'https://youtube.com/playlist?list=1' },
        ];
      }

      return [
        { id: 100, groupId: -1, hidden: false, title: 'Active', url: 'https://youtube.com/active' },
        { id: 200, groupId: -1, hidden: true, title: 'Mail', url: 'https://mail.example.com' },
        { id: 201, groupId: -1, hidden: true, title: 'Docs', url: 'https://docs.example.com' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
  });
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { currentWindow: true },
    { highlighted: true, currentWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://youtube.com/active' },
    { id: 101, title: 'Video', url: 'https://youtube.com/watch?v=1' },
    { id: 102, title: 'Playlist', url: 'https://youtube.com/playlist?list=1' },
  ]);
});

test('tabs repository ignores single highlighted Yandex tab when it is not a group context', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' }];
      }

      if (params.highlighted === true) {
        return [{ id: 100, groupId: -1, highlighted: true, title: 'Active', url: 'https://youtube.com/active' }];
      }

      return [
        { id: 100, groupId: -1, title: 'Active', url: 'https://youtube.com/active' },
        { id: 101, groupId: -1, title: 'Video', url: 'https://youtube.com/watch?v=1' },
        { id: 200, groupId: -1, title: 'Mail', url: 'https://mail.example.com' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
  });
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { currentWindow: true },
    { highlighted: true, currentWindow: true },
    { lastFocusedWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://youtube.com/active' },
    { id: 101, title: 'Video', url: 'https://youtube.com/watch?v=1' },
    { id: 200, title: 'Mail', url: 'https://mail.example.com' },
  ]);
});

test('tabs repository uses Yandex spaceId as active context when groups and hidden state are unavailable', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [
          {
            active: true,
            groupId: -1,
            id: 100,
            spaceId: 10,
            title: 'Active',
            url: 'https://example.com/active',
            windowId: 7,
          },
        ];
      }

      if (params.highlighted === true) {
        return [
          {
            active: true,
            groupId: -1,
            highlighted: true,
            id: 100,
            spaceId: 10,
            title: 'Active',
            url: 'https://example.com/active',
            windowId: 7,
          },
        ];
      }

      return [
        { id: 100, groupId: -1, spaceId: 10, title: 'Active', url: 'https://example.com/active', windowId: 7 },
        { id: 101, groupId: -1, spaceId: 10, title: 'Docs', url: 'https://example.com/docs', windowId: 7 },
        { id: 200, groupId: -1, spaceId: 20, title: 'Mail', url: 'https://mail.example.com', windowId: 7 },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
  });
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { windowId: 7 },
    { highlighted: true, windowId: 7 },
    { windowId: 7 },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://example.com/active' },
    { id: 101, title: 'Docs', url: 'https://example.com/docs' },
  ]);
});

test('tabs repository does not treat Chrome TAB_GROUP_ID_NONE as a real group', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: -1, title: 'Active', url: 'https://example.com/active' }];
      }

      if (params.highlighted === true) {
        return [{ id: 100, groupId: -1, highlighted: true, title: 'Active', url: 'https://example.com/active' }];
      }

      return [
        { id: 100, groupId: -1, title: 'Active', url: 'https://example.com/active' },
        { id: 101, groupId: -1, title: 'Docs', url: 'https://example.com/docs' },
      ];
    },
  };

  const repository = createTabsRepository(tabsApi);
  const links = await repository.listCurrentGroup();

  assert.deepEqual(queryCalls, [
    { active: true, lastFocusedWindow: true },
    { highlighted: true, currentWindow: true },
    { lastFocusedWindow: true },
  ]);
  assert.deepEqual(links, [
    { id: 100, title: 'Active', url: 'https://example.com/active' },
    { id: 101, title: 'Docs', url: 'https://example.com/docs' },
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

test('tab groups repository lists current window groups with exportable tab counts', async () => {
  const tabsQueryCalls = [];
  const groupsQueryCalls = [];
  const tabsApi = {
    async query(params) {
      tabsQueryCalls.push(params);

      if (params.active === true) {
        return [{ id: 100, groupId: 7, windowId: 3, title: 'Active', url: 'https://example.com/active' }];
      }

      return [
        { id: 10, groupId: 7, windowId: 3, title: 'Docs', url: 'https://example.com/docs' },
        { id: 11, groupId: 7, windowId: 3, title: 'Settings', url: 'chrome://settings/' },
        { id: 12, groupId: 8, windowId: 3, title: 'Video', url: 'https://youtube.com/watch?v=1' },
      ];
    },
  };
  const tabGroupsApi = {
    async query(params) {
      groupsQueryCalls.push(params);

      return [
        { id: 7, title: 'Работа', color: 'blue', windowId: 3 },
        { id: 8, title: 'Видео', color: 'red', windowId: 3 },
      ];
    },
  };

  const repository = createTabGroupsRepository(tabsApi, tabGroupsApi);
  const groups = await repository.listCurrentWindowGroups();

  assert.deepEqual(tabsQueryCalls, [
    { active: true, lastFocusedWindow: true },
    { windowId: 3 },
  ]);
  assert.deepEqual(groupsQueryCalls, [{ windowId: 3 }]);
  assert.deepEqual(groups, [
    { color: 'blue', id: 7, title: 'Работа', tabsCount: 1, windowId: 3 },
    { color: 'red', id: 8, title: 'Видео', tabsCount: 1, windowId: 3 },
  ]);
});

test('tab groups repository returns empty list when tabGroups API is unavailable', async () => {
  const repository = createTabGroupsRepository({}, null);

  assert.deepEqual(await repository.listCurrentWindowGroups(), []);
});

test('tab groups repository lists exportable tabs from selected group', async () => {
  const queryCalls = [];
  const tabsApi = {
    async query(params) {
      queryCalls.push(params);

      return [
        { id: 10, groupId: 8, windowId: 3, title: 'Video', url: 'https://youtube.com/watch?v=1' },
        { id: 11, groupId: 8, windowId: 3, title: 'Internal', url: 'chrome://newtab/' },
      ];
    },
  };

  const repository = createTabGroupsRepository(tabsApi, {
    async query() {
      return [];
    },
  });
  const links = await repository.listByGroupId(8, 3);

  assert.deepEqual(queryCalls, [{ groupId: 8, windowId: 3 }]);
  assert.deepEqual(links, [
    { id: 10, title: 'Video', url: 'https://youtube.com/watch?v=1' },
  ]);
});

test('tabs diagnostics collects safe browser tab metadata for Yandex investigation', async () => {
  const tabsQueryCalls = [];
  const groupQueryCalls = [];
  const windowCalls = [];
  const tabsApi = {
    async query(params) {
      tabsQueryCalls.push(params);

      if (params.active === true) {
        return [
          {
            active: true,
            groupId: -1,
            hidden: false,
            id: 100,
            index: 4,
            title: 'Private title',
            url: 'https://example.com/path?secret=1',
            vendorWorkspaceId: 'law',
            windowId: 3,
          },
        ];
      }

      if (params.highlighted === true) {
        return [
          {
            active: true,
            groupId: -1,
            highlighted: true,
            id: 100,
            title: 'Private title',
            url: 'https://example.com/path?secret=1',
            windowId: 3,
          },
        ];
      }

      return [
        {
          active: true,
          groupId: -1,
          hidden: false,
          id: 100,
          title: 'Private title',
          url: 'https://example.com/path?secret=1',
          vendorWorkspaceId: 'law',
          windowId: 3,
        },
        {
          groupId: -1,
          hidden: true,
          id: 101,
          pinned: true,
          title: 'Mail',
          url: 'https://mail.example.com/inbox',
          windowId: 3,
        },
      ];
    },
  };
  const tabGroupsApi = {
    async query(params) {
      groupQueryCalls.push(params);

      return [];
    },
  };
  const windowsApi = {
    async getAll(params) {
      windowCalls.push(params);

      return [
        {
          focused: true,
          id: 3,
          tabs: [
            { id: 100, url: 'https://example.com/path?secret=1' },
            { id: 101, pinned: true, url: 'https://mail.example.com/inbox' },
          ],
          type: 'normal',
        },
      ];
    },
  };

  const diagnostics = await collectTabsDiagnostics(tabsApi, tabGroupsApi, {
    userAgent: 'Mozilla/5.0 YaBrowser/26.0',
    windowsApi,
  });
  const activeWindowQuery = diagnostics.tabQueries.find((query) => query.name === 'activeWindowScope');
  const firstTab = activeWindowQuery.tabs[0];

  assert.equal(diagnostics.browser.isYandex, true);
  assert.equal(diagnostics.api.tabGroups, true);
  assert.deepEqual(tabsQueryCalls.slice(0, 2), [
    { active: true, lastFocusedWindow: true },
    { active: true, currentWindow: true },
  ]);
  assert.deepEqual(groupQueryCalls, [
    {},
    { windowId: 3 },
  ]);
  assert.deepEqual(windowCalls, [{ populate: true, windowTypes: ['normal'] }]);
  assert.equal(activeWindowQuery.counts.total, 2);
  assert.equal(activeWindowQuery.counts.exportable, 1);
  assert.deepEqual(activeWindowQuery.counts.hidden, {
    false: 1,
    missing: 0,
    true: 1,
  });
  assert.equal(firstTab.urlOrigin, 'https://example.com');
  assert.equal(firstTab.titleLength, 'Private title'.length);
  assert.equal(firstTab.extra.vendorWorkspaceId, 'law');
  assert.equal('url' in firstTab, false);
  assert.equal('title' in firstTab, false);
  assert.equal(diagnostics.windows.windows[0].tabsCounts.total, 2);
});
