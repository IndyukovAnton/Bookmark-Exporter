(function attachTabsCore(root, factory) {
  const tabsCore = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = tabsCore;
  }

  if (root) {
    root.BookmarkExporterTabsCore = tabsCore;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createTabsCore() {
  const EXPORTABLE_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

  function isExportableUrl(url) {
    if (typeof url !== 'string' || url.trim() === '') {
      return false;
    }

    try {
      return EXPORTABLE_PROTOCOLS.has(new URL(url).protocol);
    } catch (_) {
      return false;
    }
  }

  function normalizeOpenTabs(tabs) {
    if (!Array.isArray(tabs)) {
      return [];
    }

    return tabs
      .filter((tab) => tab.pinned !== true && isExportableUrl(tab.url))
      .map((tab) => {
        const title = typeof tab.title === 'string' && tab.title.trim() !== ''
          ? tab.title.trim()
          : tab.url;

        return {
          id: tab.id,
          title,
          url: tab.url,
        };
      });
  }

  return {
    EXPORTABLE_PROTOCOLS,
    isExportableUrl,
    normalizeOpenTabs,
  };
}));
