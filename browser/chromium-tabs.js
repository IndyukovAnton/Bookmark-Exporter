(function attachChromiumTabs(root, factory) {
  const tabsCore = typeof require === 'function'
    ? require('../core/tabs')
    : root.BookmarkExporterTabsCore;
  const chromiumTabs = factory(tabsCore);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = chromiumTabs;
  }

  if (root) {
    root.BookmarkExporterChromiumTabs = chromiumTabs;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createChromiumTabs(tabsCore) {
  const TAB_GROUP_ID_NONE = -1;

  function createTabsRepository(tabsApi, options = {}) {
    const normalizeTabs = options.normalizeTabs || tabsCore.normalizeOpenTabs;
    const logger = options.logger || console;
    const userAgent = options.userAgent || '';

    function assertCanQueryTabs() {
      if (!tabsApi || typeof tabsApi.query !== 'function') {
        throw new Error('Нет доступа к открытым вкладкам браузера.');
      }
    }

    async function listCurrentWindow() {
      assertCanQueryTabs();
      const tabs = await tabsApi.query({ lastFocusedWindow: true });

      return normalizeTabs(tabs);
    }

    async function listCurrentGroup() {
      assertCanQueryTabs();

      const activeTabs = await tabsApi.query({ active: true, lastFocusedWindow: true });
      const activeTab = Array.isArray(activeTabs) ? activeTabs[0] : null;

      if (!activeTab) {
        return listCurrentWindow();
      }

      if (!isRealTabGroupId(activeTab.groupId)) {
        const visibleTabs = await listVisibleContext(activeTab);

        if (visibleTabs && visibleTabs.length > 1) {
          return visibleTabs;
        }

        const highlightedTabs = await listHighlightedContext(activeTab);

        if (highlightedTabs) {
          return highlightedTabs;
        }

        const spaceTabs = await listYandexSpaceContext(activeTab);

        if (spaceTabs) {
          return spaceTabs;
        }

        if (visibleTabs) {
          return visibleTabs;
        }

        return listCurrentWindow();
      }

      try {
        const tabs = await tabsApi.query({
          groupId: activeTab.groupId,
          ...getTabWindowScope(activeTab),
        });

        return normalizeTabs(tabs);
      } catch (error) {
        logger.warn(`Could not query current tab group ${activeTab.groupId}:`, error);

        return listCurrentWindow();
      }
    }

    async function listVisibleContext(activeTab) {
      if (!isYandexBrowser(userAgent)) {
        return null;
      }

      try {
        const tabs = await tabsApi.query(getTabWindowScope(activeTab));

        if (!tabsHaveHiddenState(tabs)) {
          return null;
        }

        const visibleTabs = tabs.filter((tab) => tab && tab.hidden !== true);

        if (!visibleTabs.some((tab) => tab.id === activeTab.id)) {
          return null;
        }

        const links = normalizeTabs(visibleTabs);

        return links.length > 0 ? links : null;
      } catch (error) {
        logger.warn('Could not query visible tab context:', error);

        return null;
      }
    }

    async function listHighlightedContext(activeTab) {
      if (!shouldCheckHighlightedContext(activeTab, userAgent)) {
        return null;
      }

      try {
        const highlightedTabs = await tabsApi.query({
          highlighted: true,
          ...getTabWindowScope(activeTab),
        });

        if (!shouldUseHighlightedContext(highlightedTabs, activeTab, userAgent)) {
          return null;
        }

        const links = normalizeTabs(highlightedTabs);

        return links.length > 0 ? links : null;
      } catch (error) {
        logger.warn('Could not query highlighted tab context:', error);

        return null;
      }
    }

    async function listYandexSpaceContext(activeTab) {
      if (!isYandexBrowser(userAgent) || !hasYandexSpaceId(activeTab)) {
        return null;
      }

      try {
        const tabs = await tabsApi.query(getTabWindowScope(activeTab));
        const spaceTabs = tabs.filter((tab) => tab && tab.spaceId === activeTab.spaceId);

        if (!spaceTabs.some((tab) => tab.id === activeTab.id)) {
          return null;
        }

        const links = normalizeTabs(spaceTabs);

        return links.length > 0 ? links : null;
      } catch (error) {
        logger.warn('Could not query Yandex space context:', error);

        return null;
      }
    }

    async function closeByIds(tabIds) {
      if (!tabsApi || typeof tabsApi.remove !== 'function') {
        throw new Error('Нет доступа к закрытию вкладок браузера.');
      }

      const numericTabIds = Array.from(new Set(tabIds.filter((tabId) => typeof tabId === 'number')));

      if (numericTabIds.length === 0) {
        return 0;
      }

      try {
        await tabsApi.remove(numericTabIds);

        return numericTabIds.length;
      } catch (error) {
        logger.warn('Could not close tabs in bulk:', error);
      }

      let closedTabsCount = 0;

      for (const tabId of numericTabIds) {
        try {
          await tabsApi.remove(tabId);
          closedTabsCount += 1;
        } catch (error) {
          logger.warn(`Could not close tab ${tabId}:`, error);
        }
      }

      return closedTabsCount;
    }

    async function openUrls(urls) {
      if (!tabsApi || typeof tabsApi.create !== 'function') {
        throw new Error('Нет доступа к открытию вкладок браузера.');
      }

      const uniqueUrls = Array.from(new Set(
        urls
          .filter((url) => typeof url === 'string')
          .map((url) => url.trim())
          .filter((url) => tabsCore.isExportableUrl(url)),
      ));

      let openedTabsCount = 0;

      for (const url of uniqueUrls) {
        try {
          await tabsApi.create({
            active: false,
            url,
          });
          openedTabsCount += 1;
        } catch (error) {
          logger.warn(`Could not open tab ${url}:`, error);
        }
      }

      return openedTabsCount;
    }

    return {
      closeByIds,
      listCurrentGroup,
      listCurrentWindow,
      openUrls,
    };
  }

  function createTabGroupsRepository(tabsApi, tabGroupsApi, options = {}) {
    const normalizeTabs = options.normalizeTabs || tabsCore.normalizeOpenTabs;
    const logger = options.logger || console;

    async function listCurrentWindowGroups() {
      if (!canQueryTabs() || !canQueryTabGroups()) {
        return [];
      }

      try {
        const activeTab = await getActiveTab();
        const windowScope = getTabWindowScope(activeTab);
        const groups = await tabGroupsApi.query(windowScope);
        const tabs = await tabsApi.query(windowScope);
        const tabsCountByGroupId = countExportableTabsByGroupId(tabs);

        return groups
          .filter((group) => group && isRealTabGroupId(group.id))
          .map((group) => ({
            color: group.color,
            id: group.id,
            tabsCount: tabsCountByGroupId.get(group.id) || 0,
            title: normalizeGroupTitle(group),
            windowId: group.windowId,
          }))
          .filter((group) => group.tabsCount > 0);
      } catch (error) {
        logger.warn('Could not list tab groups:', error);

        return [];
      }
    }

    async function listByGroupId(groupId, windowId) {
      if (!canQueryTabs() || !isRealTabGroupId(groupId)) {
        return [];
      }

      const query = {
        groupId,
        ...(typeof windowId === 'number' ? { windowId } : {}),
      };
      const tabs = await tabsApi.query(query);

      return normalizeTabs(tabs);
    }

    async function getActiveTab() {
      const activeTabs = await tabsApi.query({ active: true, lastFocusedWindow: true });

      return Array.isArray(activeTabs) ? activeTabs[0] : null;
    }

    function canQueryTabs() {
      return Boolean(tabsApi && typeof tabsApi.query === 'function');
    }

    function canQueryTabGroups() {
      return Boolean(tabGroupsApi && typeof tabGroupsApi.query === 'function');
    }

    return {
      listByGroupId,
      listCurrentWindowGroups,
    };
  }

  async function fetchOpenTabs(tabsApi) {
    return createTabsRepository(tabsApi).listCurrentWindow();
  }

  async function collectTabsDiagnostics(tabsApi, tabGroupsApi, options = {}) {
    if (!tabsApi || typeof tabsApi.query !== 'function') {
      throw new Error('Нет доступа к диагностике вкладок браузера.');
    }

    const userAgent = options.userAgent || '';
    const activeLastFocused = await queryTabsDiagnostics(
      tabsApi,
      'activeLastFocused',
      { active: true, lastFocusedWindow: true },
    );
    const activeCurrentWindow = await queryTabsDiagnostics(
      tabsApi,
      'activeCurrentWindow',
      { active: true, currentWindow: true },
    );
    const activeTab = activeLastFocused.rawTabs[0] || activeCurrentWindow.rawTabs[0] || null;
    const activeWindowScope = getTabWindowScope(activeTab);
    const tabQueries = [
      activeLastFocused,
      activeCurrentWindow,
      await queryTabsDiagnostics(tabsApi, 'lastFocusedWindow', { lastFocusedWindow: true }),
      await queryTabsDiagnostics(tabsApi, 'currentWindow', { currentWindow: true }),
      await queryTabsDiagnostics(tabsApi, 'activeWindowScope', activeWindowScope),
      await queryTabsDiagnostics(tabsApi, 'highlightedActiveWindow', {
        highlighted: true,
        ...activeWindowScope,
      }),
      await queryTabsDiagnostics(tabsApi, 'pinnedActiveWindow', {
        pinned: true,
        ...activeWindowScope,
      }),
    ];

    return {
      api: {
        tabGroups: Boolean(tabGroupsApi && typeof tabGroupsApi.query === 'function'),
        tabs: true,
        windows: Boolean(options.windowsApi && typeof options.windowsApi.getAll === 'function'),
      },
      browser: {
        isYandex: isYandexBrowser(userAgent),
        userAgent,
      },
      tabGroups: await collectTabGroupsDiagnostics(tabGroupsApi, activeWindowScope),
      tabQueries: tabQueries.map(removeRawTabs),
      windows: await collectWindowsDiagnostics(options.windowsApi),
    };
  }

  function isRealTabGroupId(groupId) {
    return typeof groupId === 'number' && groupId > TAB_GROUP_ID_NONE;
  }

  function getTabWindowScope(tab) {
    return tab && typeof tab.windowId === 'number'
      ? { windowId: tab.windowId }
      : { currentWindow: true };
  }

  function isYandexBrowser(userAgent) {
    return /YaBrowser/i.test(String(userAgent || ''));
  }

  function shouldCheckHighlightedContext(activeTab, userAgent) {
    return isYandexBrowser(userAgent) || Object.prototype.hasOwnProperty.call(activeTab, 'groupId');
  }

  function shouldUseHighlightedContext(tabs, activeTab, userAgent) {
    if (!Array.isArray(tabs) || tabs.length === 0) {
      return false;
    }

    const hasActiveTab = tabs.some((tab) => tab && tab.id === activeTab.id);

    if (!hasActiveTab) {
      return false;
    }

    return tabs.length > 1;
  }

  function tabsHaveHiddenState(tabs) {
    return Array.isArray(tabs)
      && tabs.some((tab) => tab && Object.prototype.hasOwnProperty.call(tab, 'hidden'));
  }

  function hasYandexSpaceId(tab) {
    return tab
      && (typeof tab.spaceId === 'number' || typeof tab.spaceId === 'string')
      && String(tab.spaceId).trim() !== '';
  }

  function countExportableTabsByGroupId(tabs) {
    const counts = new Map();

    if (!Array.isArray(tabs)) {
      return counts;
    }

    tabs.forEach((tab) => {
      if (!tab || !isRealTabGroupId(tab.groupId) || !tabsCore.isExportableUrl(tab.url) || tab.pinned === true) {
        return;
      }

      counts.set(tab.groupId, (counts.get(tab.groupId) || 0) + 1);
    });

    return counts;
  }

  async function queryTabsDiagnostics(tabsApi, name, queryInfo) {
    try {
      const tabs = await tabsApi.query(queryInfo);
      const safeTabs = Array.isArray(tabs) ? tabs : [];

      return {
        counts: buildDiagnosticsCounts(safeTabs),
        name,
        queryInfo,
        rawTabs: safeTabs,
        tabs: safeTabs.map(sanitizeDiagnosticTab),
      };
    } catch (error) {
      return {
        error: sanitizeDiagnosticError(error),
        name,
        queryInfo,
        rawTabs: [],
        tabs: [],
      };
    }
  }

  async function collectTabGroupsDiagnostics(tabGroupsApi, activeWindowScope) {
    if (!tabGroupsApi || typeof tabGroupsApi.query !== 'function') {
      return {
        available: false,
        queries: [],
      };
    }

    const queries = [
      await queryTabGroupsDiagnostics(tabGroupsApi, 'allGroups', {}),
      await queryTabGroupsDiagnostics(tabGroupsApi, 'activeWindowGroups', activeWindowScope),
    ];

    return {
      available: true,
      queries,
    };
  }

  async function queryTabGroupsDiagnostics(tabGroupsApi, name, queryInfo) {
    try {
      const groups = await tabGroupsApi.query(queryInfo);
      const safeGroups = Array.isArray(groups) ? groups : [];

      return {
        count: safeGroups.length,
        groups: safeGroups.map(sanitizeDiagnosticGroup),
        name,
        queryInfo,
      };
    } catch (error) {
      return {
        error: sanitizeDiagnosticError(error),
        name,
        queryInfo,
      };
    }
  }

  async function collectWindowsDiagnostics(windowsApi) {
    if (!windowsApi || typeof windowsApi.getAll !== 'function') {
      return {
        available: false,
        windows: [],
      };
    }

    try {
      const windows = await windowsApi.getAll({ populate: true, windowTypes: ['normal'] });
      const safeWindows = Array.isArray(windows) ? windows : [];

      return {
        available: true,
        windows: safeWindows.map(sanitizeDiagnosticWindow),
      };
    } catch (error) {
      return {
        available: true,
        error: sanitizeDiagnosticError(error),
        windows: [],
      };
    }
  }

  function sanitizeDiagnosticTab(tab) {
    if (!tab || typeof tab !== 'object') {
      return null;
    }

    const knownFields = [
      'active',
      'audible',
      'autoDiscardable',
      'discarded',
      'frozen',
      'groupId',
      'height',
      'hidden',
      'highlighted',
      'id',
      'incognito',
      'index',
      'openerTabId',
      'pinned',
      'selected',
      'status',
      'width',
      'windowId',
    ];
    const result = pickExistingFields(tab, knownFields);

    result.keys = Object.keys(tab).sort();

    if (typeof tab.title === 'string') {
      result.titleLength = tab.title.length;
    }

    if (typeof tab.url === 'string') {
      result.urlOrigin = sanitizeDiagnosticUrl(tab.url);
    }

    if (typeof tab.pendingUrl === 'string') {
      result.pendingUrlOrigin = sanitizeDiagnosticUrl(tab.pendingUrl);
    }

    if (typeof tab.favIconUrl === 'string') {
      result.favIconUrlOrigin = sanitizeDiagnosticUrl(tab.favIconUrl);
    }

    if (tab.mutedInfo && typeof tab.mutedInfo === 'object') {
      result.mutedInfo = pickExistingFields(tab.mutedInfo, ['muted', 'reason', 'extensionId']);
    }

    const extra = pickUnknownPrimitiveFields(tab, new Set([
      ...knownFields,
      'favIconUrl',
      'mutedInfo',
      'pendingUrl',
      'title',
      'url',
    ]));

    if (Object.keys(extra).length > 0) {
      result.extra = extra;
    }

    return result;
  }

  function sanitizeDiagnosticGroup(group) {
    if (!group || typeof group !== 'object') {
      return null;
    }

    const result = pickExistingFields(group, ['collapsed', 'color', 'id', 'title', 'windowId']);
    const extra = pickUnknownPrimitiveFields(group, new Set(Object.keys(result)));

    result.keys = Object.keys(group).sort();

    if (Object.keys(extra).length > 0) {
      result.extra = extra;
    }

    return result;
  }

  function sanitizeDiagnosticWindow(windowInfo) {
    if (!windowInfo || typeof windowInfo !== 'object') {
      return null;
    }

    const tabs = Array.isArray(windowInfo.tabs) ? windowInfo.tabs : [];
    const result = pickExistingFields(windowInfo, [
      'alwaysOnTop',
      'focused',
      'height',
      'id',
      'incognito',
      'left',
      'state',
      'top',
      'type',
      'width',
    ]);

    result.keys = Object.keys(windowInfo).sort();
    result.tabsCount = tabs.length;
    result.tabsCounts = buildDiagnosticsCounts(tabs);

    return result;
  }

  function buildDiagnosticsCounts(tabs) {
    const counts = {
      byGroupId: {},
      exportable: 0,
      hidden: {
        false: 0,
        missing: 0,
        true: 0,
      },
      highlighted: 0,
      pinned: 0,
      total: Array.isArray(tabs) ? tabs.length : 0,
    };

    if (!Array.isArray(tabs)) {
      return counts;
    }

    tabs.forEach((tab) => {
      if (!tab || typeof tab !== 'object') {
        return;
      }

      if (tabsCore.isExportableUrl(tab.url) && tab.pinned !== true) {
        counts.exportable += 1;
      }

      if (tab.highlighted === true) {
        counts.highlighted += 1;
      }

      if (tab.pinned === true) {
        counts.pinned += 1;
      }

      if (tab.hidden === true) {
        counts.hidden.true += 1;
      } else if (tab.hidden === false) {
        counts.hidden.false += 1;
      } else {
        counts.hidden.missing += 1;
      }

      const groupKey = typeof tab.groupId === 'number' ? String(tab.groupId) : 'missing';
      counts.byGroupId[groupKey] = (counts.byGroupId[groupKey] || 0) + 1;
    });

    return counts;
  }

  function removeRawTabs(queryResult) {
    const { rawTabs, ...safeResult } = queryResult;

    return safeResult;
  }

  function pickExistingFields(source, fields) {
    return fields.reduce((result, fieldName) => {
      if (Object.prototype.hasOwnProperty.call(source, fieldName)) {
        result[fieldName] = source[fieldName];
      }

      return result;
    }, {});
  }

  function pickUnknownPrimitiveFields(source, knownFields) {
    return Object.keys(source).sort().reduce((result, fieldName) => {
      if (knownFields.has(fieldName)) {
        return result;
      }

      const value = source[fieldName];

      if (isPrimitiveDiagnosticValue(value)) {
        result[fieldName] = sanitizeDiagnosticPrimitive(value);
      }

      return result;
    }, {});
  }

  function isPrimitiveDiagnosticValue(value) {
    return value === null || ['boolean', 'number', 'string'].includes(typeof value);
  }

  function sanitizeDiagnosticPrimitive(value) {
    if (typeof value !== 'string') {
      return value;
    }

    if (looksLikeUrl(value)) {
      return sanitizeDiagnosticUrl(value);
    }

    return value.length > 120
      ? `${value.slice(0, 120)}... [${value.length}]`
      : value;
  }

  function looksLikeUrl(value) {
    return /^[a-z][a-z0-9+.-]*:/i.test(value);
  }

  function sanitizeDiagnosticUrl(url) {
    try {
      const parsedUrl = new URL(url);

      if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:') {
        return parsedUrl.origin;
      }

      if (parsedUrl.protocol === 'file:') {
        return 'file://[local-path]';
      }

      return `${parsedUrl.protocol}${parsedUrl.hostname ? `//${parsedUrl.hostname}` : ''}`;
    } catch (error) {
      return '[invalid-url]';
    }
  }

  function sanitizeDiagnosticError(error) {
    return {
      message: error && error.message ? error.message : String(error),
      name: error && error.name ? error.name : 'Error',
    };
  }

  function normalizeGroupTitle(group) {
    return typeof group.title === 'string' && group.title.trim() !== ''
      ? group.title.trim()
      : `Группа ${group.id}`;
  }

  return {
    TAB_GROUP_ID_NONE,
    collectTabsDiagnostics,
    createTabGroupsRepository,
    createTabsRepository,
    countExportableTabsByGroupId,
    fetchOpenTabs,
    getTabWindowScope,
    isRealTabGroupId,
    isYandexBrowser,
    tabsHaveHiddenState,
  };
}));
