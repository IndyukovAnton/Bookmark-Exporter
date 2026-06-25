(function attachImportFlow(root, factory) {
  const importFlow = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = importFlow;
  }

  if (root) {
    root.BookmarkExporterImportFlow = importFlow;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createImportFlowModule() {
  function createImportFlow(options = {}) {
    const logger = options.logger || console;
    const dom = options.dom;
    const defaultSettings = options.defaultSettings || {};
    const importFileCore = options.importFileCore;
    const settingsRepository = options.settingsRepository || {};
    const tabsRepository = options.tabsRepository || {};
    let isImporting = false;

    function selectImportFile(elements) {
      elements.importFile.click();
    }

    async function readImportFile(elements) {
      const file = elements.importFile.files && elements.importFile.files[0];

      if (!file) {
        return;
      }

      try {
        if (typeof file.text !== 'function') {
          throw new Error('Не удалось прочитать файл в этом браузере.');
        }

        elements.importText.value = await file.text();
        elements.importFileName.textContent = file.name || 'Файл выбран';
        dom.setStatus(elements, 'info', 'Файл загружен. Проверьте список и нажмите "Открыть ссылки".');
      } catch (error) {
        logger.error('Import file reading failed:', error);
        dom.setStatus(elements, 'error', error.message || 'Не удалось прочитать файл.');
      }
    }

    async function importLinks(elements) {
      if (isImporting) {
        return;
      }

      const links = importFileCore.parseImportedLinks(elements.importText.value);

      if (links.length === 0) {
        dom.setStatus(elements, 'warning', 'Не нашёл ссылок для импорта.');
        return;
      }

      const importLimit = await saveImportLimit(elements);
      const limitedLinks = links.slice(0, importLimit);

      setBusy(elements, true);
      dom.setStatus(elements, 'info', buildOpeningMessage(limitedLinks.length, links.length));

      try {
        const openedTabsCount = await tabsRepository.openUrls(limitedLinks.map((link) => link.url));

        if (openedTabsCount === 0) {
          dom.setStatus(elements, 'warning', 'Не удалось открыть найденные ссылки.');
          return;
        }

        dom.setStatus(elements, 'success', buildImportSuccessMessage(openedTabsCount, links.length));
      } catch (error) {
        logger.error('Import failed:', error);
        dom.setStatus(elements, 'error', error.message || 'Не удалось импортировать ссылки.');
      } finally {
        setBusy(elements, false);
      }
    }

    async function saveImportLimit(elements) {
      const importLimit = readImportLimit(elements);

      if (elements.importLimit) {
        elements.importLimit.value = String(importLimit);
      }

      if (typeof settingsRepository.saveImportLimit === 'function') {
        await settingsRepository.saveImportLimit(importLimit);
      }

      return importLimit;
    }

    function readImportLimit(elements) {
      const defaultImportLimit = normalizeImportLimit(defaultSettings.importLimit, 50);

      if (!elements.importLimit) {
        return defaultImportLimit;
      }

      return normalizeImportLimit(elements.importLimit.value, defaultImportLimit);
    }

    function normalizeImportLimit(value, fallback) {
      const limit = Number(value);

      if (!Number.isInteger(limit) || limit < 1) {
        return fallback;
      }

      return limit;
    }

    function buildOpeningMessage(limitedCount, totalCount) {
      if (limitedCount === totalCount) {
        return `Открываю вкладки: ${limitedCount}...`;
      }

      return `Открываю вкладки: ${limitedCount} из ${totalCount}...`;
    }

    function buildImportSuccessMessage(openedTabsCount, totalLinksCount) {
      if (openedTabsCount === totalLinksCount) {
        return `Открыто вкладок: ${openedTabsCount}.`;
      }

      return `Открыто вкладок: ${openedTabsCount} из ${totalLinksCount}.`;
    }

    function setBusy(elements, value) {
      isImporting = value;
      dom.setImportBusy(elements, value);
    }

    return {
      importLinks,
      readImportFile,
      saveImportLimit,
      selectImportFile,
    };
  }

  return {
    createImportFlow,
  };
}));
