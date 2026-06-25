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
    const importFileCore = options.importFileCore;
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

      setBusy(elements, true);
      dom.setStatus(elements, 'info', `Открываю вкладки: ${links.length}...`);

      try {
        const openedTabsCount = await tabsRepository.openUrls(links.map((link) => link.url));

        if (openedTabsCount === 0) {
          dom.setStatus(elements, 'warning', 'Не удалось открыть найденные ссылки.');
          return;
        }

        dom.setStatus(elements, 'success', `Открыто вкладок: ${openedTabsCount}.`);
      } catch (error) {
        logger.error('Import failed:', error);
        dom.setStatus(elements, 'error', error.message || 'Не удалось импортировать ссылки.');
      } finally {
        setBusy(elements, false);
      }
    }

    function setBusy(elements, value) {
      isImporting = value;
      dom.setImportBusy(elements, value);
    }

    return {
      importLinks,
      readImportFile,
      selectImportFile,
    };
  }

  return {
    createImportFlow,
  };
}));
