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
    fileSaveStrategies: typeof require === 'function'
      ? require('../browser/file-save-strategies')
      : root.BookmarkExporterFileSaveStrategies,
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
  const ALLOWED_FORMATS = new Set(['html', 'md', 'txt']);

  function createPopupController(options = {}) {
    const documentRef = options.documentRef || root.document;
    const windowRef = options.windowRef || root;
    const chromeApi = options.chromeApi || root.chrome;
    const logger = options.logger || console;
    const exportFileCore = options.exportFileCore || modules.exportFileCore;
    const fileSaveStrategies = options.fileSaveStrategies || modules.fileSaveStrategies;
    const popupMessages = options.popupMessages || modules.popupMessages;
    const settingsRepository = options.settingsRepository
      || modules.chromiumStorage.createSettingsRepository(chromeApi.storage.sync);
    const tabsRepository = options.tabsRepository
      || modules.chromiumTabs.createTabsRepository(chromeApi.tabs, { logger });
    const defaultSettings = modules.chromiumStorage.DEFAULT_SETTINGS;
    let selectedDirectoryHandle = null;
    let isExporting = false;

    async function init() {
      const elements = getElements();

      await restoreSettings(elements);
      bindEvents(elements);
      await refreshTabsSummary(elements);
    }

    function getElements() {
      return {
        closeAfterExport: documentRef.getElementById('closeAfterExport'),
        exportBtn: documentRef.getElementById('exportBtn'),
        filename: documentRef.getElementById('filename'),
        savePath: documentRef.getElementById('savePath'),
        selectPathBtn: documentRef.getElementById('selectPathBtn'),
        status: documentRef.getElementById('status'),
        tabsCount: documentRef.getElementById('tabsCount'),
        tabsLabel: documentRef.getElementById('tabsLabel'),
      };
    }

    async function restoreSettings(elements) {
      const settings = await settingsRepository.getSettings();
      const format = normalizeFormat(settings.format);
      const formatInput = documentRef.querySelector(`input[name="format"][value="${format}"]`);

      if (formatInput) {
        formatInput.checked = true;
      }

      elements.filename.value = settings.filename || defaultSettings.filename;
      elements.closeAfterExport.checked = Boolean(settings.closeAfterExport);
      elements.savePath.value = settings.savePathName || 'Загрузки';
    }

    function bindEvents(elements) {
      elements.selectPathBtn.addEventListener('click', () => selectSaveDirectory(elements));
      elements.exportBtn.addEventListener('click', () => exportOpenTabs(elements));
    }

    async function refreshTabsSummary(elements) {
      try {
        const links = await tabsRepository.listCurrentWindow();

        elements.tabsCount.textContent = String(links.length);
        elements.tabsLabel.textContent = popupMessages.getTabsLabel(links.length);
      } catch (error) {
        elements.tabsCount.textContent = '0';
        elements.tabsLabel.textContent = 'вкладок';
        setStatus(elements, 'error', error.message);
      }
    }

    async function selectSaveDirectory(elements) {
      if (!fileSaveStrategies.supportsDirectoryPicker(windowRef)) {
        setStatus(elements, 'warning', 'Выбор папки недоступен в этом браузере. Файл будет скачан в Загрузки.');
        return;
      }

      try {
        selectedDirectoryHandle = await fileSaveStrategies.selectDirectory(windowRef);
        elements.savePath.value = selectedDirectoryHandle.name || 'Выбранная папка';

        await settingsRepository.savePathName(elements.savePath.value);

        setStatus(elements, 'info', `Папка сохранения: ${elements.savePath.value}`);
      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.error('Directory selection failed:', error);
          setStatus(elements, 'error', 'Не удалось выбрать папку. Попробуйте еще раз.');
        }
      }
    }

    async function exportOpenTabs(elements) {
      if (isExporting) {
        return;
      }

      const exportOptions = readExportOptions(elements);

      await settingsRepository.saveExportSettings(exportOptions);
      setBusy(elements, true);
      setStatus(elements, 'info', 'Готовлю список открытых вкладок...');

      try {
        const links = await tabsRepository.listCurrentWindow();

        if (links.length === 0) {
          setStatus(elements, 'info', 'Нет открытых страниц, которые можно экспортировать.');
          return;
        }

        const exportFile = exportFileCore.buildExportFile({
          filename: exportOptions.filename,
          format: exportOptions.format,
          links,
        });
        const saveResult = await fileSaveStrategies.saveExportFile(exportFile, {
          documentRef,
          selectedDirectoryHandle,
          windowRef,
        });
        const closedTabsCount = exportOptions.closeAfterExport
          ? await tabsRepository.closeByIds(links.map((link) => link.id))
          : 0;

        setStatus(
          elements,
          'success',
          popupMessages.buildExportSuccessMessage({
            closedTabsCount,
            closeAfterExport: exportOptions.closeAfterExport,
            exportedTabsCount: links.length,
            filename: exportFile.fullFilename,
            locationName: saveResult.locationName,
          }),
        );

        await refreshTabsSummary(elements);
      } catch (error) {
        logger.error('Export failed:', error);
        setStatus(elements, 'error', error.message || 'Не удалось экспортировать вкладки.');
      } finally {
        setBusy(elements, false);
      }
    }

    function readExportOptions(elements) {
      const checkedFormatInput = documentRef.querySelector('input[name="format"]:checked');
      const format = normalizeFormat(checkedFormatInput ? checkedFormatInput.value : defaultSettings.format);
      const filename = elements.filename.value.trim() || defaultSettings.filename;

      return {
        closeAfterExport: elements.closeAfterExport.checked,
        filename,
        format,
      };
    }

    function normalizeFormat(format) {
      return ALLOWED_FORMATS.has(format) ? format : defaultSettings.format;
    }

    function setBusy(elements, value) {
      isExporting = value;
      elements.exportBtn.disabled = value;
      elements.exportBtn.textContent = value ? 'Экспорт...' : 'Экспортировать вкладки';
    }

    function setStatus(elements, type, message) {
      elements.status.hidden = false;
      elements.status.className = `status status--${type}`;
      elements.status.textContent = message;
    }

    return {
      exportOpenTabs,
      init,
      refreshTabsSummary,
      selectSaveDirectory,
    };
  }

  return {
    createPopupController,
  };
}));
