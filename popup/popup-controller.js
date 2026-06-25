(function attachPopupController(root, factory) {
  const dependencies = {
    chromiumStorage: typeof require === 'function'
      ? require('../browser/chromium-storage')
      : root.BookmarkExporterChromiumStorage,
    chromiumTabs: typeof require === 'function'
      ? require('../browser/chromium-tabs')
      : root.BookmarkExporterChromiumTabs,
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
    const tabsRepository = options.tabsRepository
      || modules.chromiumTabs.createTabsRepository(chromeApi.tabs, { logger });
    const exportActions = createExportActions({
      documentRef,
      logger,
      settingsRepository,
      tabsRepository,
      windowRef,
      options,
      popupDom,
    });
    const importActions = createImportActions({
      logger,
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
      elements.selectPathBtn.addEventListener('click', () => exportActions.selectSaveDirectory(elements));
      elements.exportBtn.addEventListener('click', () => exportActions.exportOpenTabs(elements));
      elements.selectImportFileBtn.addEventListener('click', () => importActions.selectImportFile(elements));
      elements.importFile.addEventListener('change', () => importActions.readImportFile(elements));
      elements.importBtn.addEventListener('click', () => importActions.importLinks(elements));
    }

    return {
      exportOpenTabs: exportActions.exportOpenTabs,
      importLinks: importActions.importLinks,
      init,
      refreshTabsSummary: exportActions.refreshTabsSummary,
      selectSaveDirectory: exportActions.selectSaveDirectory,
    };
  }

  function createExportActions({
    documentRef,
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
    tabsRepository,
    options,
    popupDom,
  }) {
    const importFlowModule = options.importFlow || modules.importFlow;

    return importFlowModule.createImportFlow({
      dom: popupDom,
      importFileCore: options.importFileCore || modules.importFileCore,
      logger,
      tabsRepository,
    });
  }

  return {
    createPopupController,
  };
}));
