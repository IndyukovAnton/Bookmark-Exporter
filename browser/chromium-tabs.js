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

    async function listCurrentWindow() {
      if (!tabsApi || typeof tabsApi.query !== 'function') {
        throw new Error('Нет доступа к открытым вкладкам браузера.');
      }

      const tabs = await tabsApi.query({ currentWindow: true });

      return normalizeTabs(tabs);
    }

    async function closeByIds(tabIds) {
      if (!tabsApi || typeof tabsApi.remove !== 'function') {
        throw new Error('Нет доступа к закрытию вкладок браузера.');
      }

      let closedTabsCount = 0;

      for (const tabId of tabIds) {
        if (typeof tabId !== 'number') {
          continue;
        }

        try {
          await tabsApi.remove(tabId);
          closedTabsCount += 1;
        } catch (error) {
          logger.warn(`Could not close tab ${tabId}:`, error);
        }
      }

      return closedTabsCount;
    }

    return {
      closeByIds,
      listCurrentWindow,
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
