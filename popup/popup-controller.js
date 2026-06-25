(function attachPopupController(root, factory) {
  const dependencies = {
    chromiumStorage: typeof require === 'function'
      ? require('../browser/chromium-storage')
      : root.BookmarkExporterChromiumStorage,
    chromiumTabs: typeof require === 'function'
      ? require('../browser/chromium-tabs')
      : root.BookmarkExporterChromiumTabs,
    directoryHandleStorage: typeof require === 'function'
      ? require('../browser/directory-handle-storage')
      : root.BookmarkExporterDirectoryHandleStorage,
    exportFileCore: typeof require === 'function'
      ? require('../core/export-file')
      : root.BookmarkExporterExportFile,
    exportFlow: typeof require === 'function'
      ? require('./export-flow')
      : root.BookmarkExporterExportFlow,
    importFileCore: typeof require === 'function'
      ? require('../core/import-file')
      : root.BookmarkExporterImportFile,
    importFlow: typeof require === 'function'
      ? require('./import-flow')
      : root.BookmarkExporterImportFlow,
    fileSaveStrategies: typeof require === 'function'
      ? require('../browser/file-save-strategies')
      : root.BookmarkExporterFileSaveStrategies,
    popupDom: typeof require === 'function'
      ? require('./dom')
      : root.BookmarkExporterPopupDom,
    popupMessages: typeof require === 'function'
      ? require('./messages')
      : root.BookmarkExporterPopupMessages,
  };
  const popupController = factory(root, dependencies);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = popupController;
  }

  if (root) {
    root.BookmarkExporterPopupController = popupController;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createPopupControllerModule(root, modules) {
  function createPopupController(options = {}) {
    const documentRef = options.documentRef || root.document;
    const windowRef = options.windowRef || root;
    const chromeApi = options.chromeApi || root.chrome;
    const logger = options.logger || console;
    const popupDom = options.popupDom || modules.popupDom;
    const settingsRepository = options.settingsRepository
      || modules.chromiumStorage.createSettingsRepository(chromeApi.storage.sync);
    const directoryHandleRepository = options.directoryHandleRepository
      || modules.directoryHandleStorage.createDirectoryHandleRepository(getIndexedDb(windowRef, root));
    const tabsRepository = options.tabsRepository
      || modules.chromiumTabs.createTabsRepository(chromeApi.tabs, {
        logger,
        userAgent: getUserAgent(windowRef),
      });
    const tabsDiagnosticsProvider = options.tabsDiagnosticsProvider || (() => (
      modules.chromiumTabs.collectTabsDiagnostics(
        chromeApi && chromeApi.tabs,
        chromeApi && chromeApi.tabGroups,
        {
          userAgent: getUserAgent(windowRef),
          windowsApi: chromeApi && chromeApi.windows,
        },
      )
    ));
    const exportActions = createExportActions({
      documentRef,
      directoryHandleRepository,
      logger,
      settingsRepository,
      tabsRepository,
      windowRef,
      options,
      popupDom,
    });
    const importActions = createImportActions({
      logger,
      settingsRepository,
      tabsRepository,
      options,
      popupDom,
    });

    async function init() {
      const elements = popupDom.getElements(documentRef);

      await exportActions.restoreSettings(elements);
      bindEvents(elements);
      popupDom.showMode(elements, 'export');
      await exportActions.refreshTabsSummary(elements);
    }

    function bindEvents(elements) {
      elements.exportTabBtn.addEventListener('click', () => popupDom.showMode(elements, 'export'));
      elements.importTabBtn.addEventListener('click', () => popupDom.showMode(elements, 'import'));
      elements.settingsTabBtn.addEventListener('click', () => popupDom.showMode(elements, 'settings'));
      elements.selectPathBtn.addEventListener('click', () => exportActions.selectSaveDirectory(elements));
      elements.exportBtn.addEventListener('click', () => exportActions.exportOpenTabs(elements));
      elements.selectImportFileBtn.addEventListener('click', () => importActions.selectImportFile(elements));
      elements.importFile.addEventListener('change', () => importActions.readImportFile(elements));
      elements.importLimit.addEventListener('change', () => importActions.saveImportLimit(elements));
      elements.importBtn.addEventListener('click', () => importActions.importLinks(elements));
      if (elements.copyDiagnosticsBtn) {
        elements.copyDiagnosticsBtn.addEventListener('click', () => copyTabsDiagnostics(elements));
      }
    }

    async function copyTabsDiagnostics(elements) {
      try {
        const diagnostics = await tabsDiagnosticsProvider();
        const text = JSON.stringify(diagnostics, null, 2);

        await copyTextToClipboard(windowRef, documentRef, text);
        popupDom.setStatus(
          elements,
          'success',
          'Диагностика скопирована. Пришлите JSON из буфера обмена для проверки полей Яндекс.Браузера.',
        );
      } catch (error) {
        logger.error('Tabs diagnostics failed:', error);
        popupDom.setStatus(elements, 'error', error.message || 'Не удалось скопировать диагностику.');
      }
    }

    return {
      copyTabsDiagnostics,
      exportOpenTabs: exportActions.exportOpenTabs,
      importLinks: importActions.importLinks,
      init,
      refreshTabsSummary: exportActions.refreshTabsSummary,
      selectSaveDirectory: exportActions.selectSaveDirectory,
    };
  }

  function getUserAgent(windowRef) {
    return windowRef && windowRef.navigator && typeof windowRef.navigator.userAgent === 'string'
      ? windowRef.navigator.userAgent
      : '';
  }

  function getIndexedDb(windowRef, rootRef) {
    if (windowRef && windowRef.indexedDB) {
      return windowRef.indexedDB;
    }

    return rootRef && rootRef.indexedDB ? rootRef.indexedDB : null;
  }

  async function copyTextToClipboard(windowRef, documentRef, text) {
    const clipboard = windowRef && windowRef.navigator && windowRef.navigator.clipboard;

    if (clipboard && typeof clipboard.writeText === 'function') {
      await clipboard.writeText(text);
      return;
    }

    if (
      documentRef
      && documentRef.body
      && typeof documentRef.createElement === 'function'
      && typeof documentRef.execCommand === 'function'
    ) {
      const textarea = documentRef.createElement('textarea');

      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      documentRef.body.appendChild(textarea);
      textarea.select();
      documentRef.execCommand('copy');
      textarea.remove();
      return;
    }

    throw new Error('Буфер обмена недоступен в этом браузере.');
  }

  function createExportActions({
    documentRef,
    directoryHandleRepository,
    logger,
    settingsRepository,
    tabsRepository,
    windowRef,
    options,
    popupDom,
  }) {
    const exportFlowModule = options.exportFlow || modules.exportFlow;

    return exportFlowModule.createExportFlow({
      defaultSettings: modules.chromiumStorage.DEFAULT_SETTINGS,
      documentRef,
      directoryHandleRepository,
      dom: popupDom,
      exportFileCore: options.exportFileCore || modules.exportFileCore,
      fileSaveStrategies: options.fileSaveStrategies || modules.fileSaveStrategies,
      logger,
      popupMessages: options.popupMessages || modules.popupMessages,
      settingsRepository,
      tabsRepository,
      windowRef,
    });
  }

  function createImportActions({
    logger,
    settingsRepository,
    tabsRepository,
    options,
    popupDom,
  }) {
    const importFlowModule = options.importFlow || modules.importFlow;

    return importFlowModule.createImportFlow({
      defaultSettings: modules.chromiumStorage.DEFAULT_SETTINGS,
      dom: popupDom,
      importFileCore: options.importFileCore || modules.importFileCore,
      logger,
      settingsRepository,
      tabsRepository,
    });
  }

  return {
    createPopupController,
  };
}));
