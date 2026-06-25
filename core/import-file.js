(function attachImportFileCore(root, factory) {
  const tabsCore = typeof require === 'function'
    ? require('./tabs')
    : root.BookmarkExporterTabsCore;
  const importFileCore = factory(tabsCore);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = importFileCore;
  }

  if (root) {
    root.BookmarkExporterImportFile = importFileCore;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createImportFileCore(tabsCore) {
  const URL_PATTERN = /\b(?:https?:\/\/|file:\/\/\/?)[^\s<>"']+/gi;
  const TRAILING_URL_CHARACTERS = /[)\].,;]+$/;

  function decodeHtmlEntities(value) {
    return String(value)
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function normalizeImportedUrl(value) {
    return decodeHtmlEntities(value)
      .trim()
      .replace(TRAILING_URL_CHARACTERS, '');
  }

  function createLinksCollector() {
    const seenUrls = new Set();
    const links = [];

    function add(value, title = '') {
      const url = normalizeImportedUrl(value);

      if (!tabsCore.isExportableUrl(url) || seenUrls.has(url)) {
        return;
      }

      const normalizedTitle = typeof title === 'string' && title.trim() !== ''
        ? title.trim()
        : url;

      seenUrls.add(url);
      links.push({
        title: normalizedTitle,
        url,
      });
    }

    return {
      add,
      links,
    };
  }

  function collectJsonLinks(value, collector) {
    let parsed;

    try {
      parsed = JSON.parse(value);
    } catch (_) {
      return false;
    }

    const entries = Array.isArray(parsed)
      ? parsed
      : parsed && Array.isArray(parsed.links)
        ? parsed.links
        : null;

    if (!entries) {
      return false;
    }

    entries.forEach((entry) => {
      if (typeof entry === 'string') {
        collector.add(entry);
        return;
      }

      if (entry && typeof entry.url === 'string') {
        collector.add(entry.url, entry.title);
      }
    });

    return true;
  }

  function collectTextLinks(value, collector) {
    const urlMatches = value.matchAll(URL_PATTERN);

    Array.from(urlMatches).forEach((match) => {
      collector.add(match[0]);
    });
  }

  function parseImportedLinks(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    const collector = createLinksCollector();
    const isJson = collectJsonLinks(value, collector);

    if (!isJson) {
      collectTextLinks(value, collector);
    }

    return collector.links;
  }

  return {
    parseImportedLinks,
  };
}));
