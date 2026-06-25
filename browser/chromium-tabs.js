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
  function createTabsRepository(tabsApi, options = {}) {
    const normalizeTabs = options.normalizeTabs || tabsCore.normalizeOpenTabs;
    const logger = options.logger || console;

    function assertCanQueryTabs() {
      if (!tabsApi || typeof tabsApi.query !== 'function') {
        throw new Error('Нет доступа к открытым вкладкам браузера.');
      }
    }

    async function listCurrentWindow() {
      assertCanQueryTabs();
      const tabs = await tabsApi.query({ currentWindow: true });

      return normalizeTabs(tabs);
    }

    async function listCurrentGroup() {
      assertCanQueryTabs();

      const activeTabs = await tabsApi.query({ active: true, currentWindow: true });
      const activeTab = Array.isArray(activeTabs) ? activeTabs[0] : null;

      if (!activeTab || typeof activeTab.groupId !== 'number') {
        return listCurrentWindow();
      }

      try {
        const tabs = await tabsApi.query({
          currentWindow: true,
          groupId: activeTab.groupId,
        });

        return normalizeTabs(tabs);
      } catch (error) {
        logger.warn(`Could not query current tab group ${activeTab.groupId}:`, error);

        return listCurrentWindow();
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

  async function fetchOpenTabs(tabsApi) {
    return createTabsRepository(tabsApi).listCurrentWindow();
  }

  return {
    createTabsRepository,
    fetchOpenTabs,
  };
}));
