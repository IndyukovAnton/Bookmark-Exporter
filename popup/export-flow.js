(function attachExportFlow(root, factory) {
  const exportFlow = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exportFlow;
  }

  if (root) {
    root.BookmarkExporterExportFlow = exportFlow;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createExportFlowModule() {
  const ALLOWED_FORMATS = new Set(['html', 'json', 'md', 'txt']);

  function createExportFlow(options = {}) {
    const documentRef = options.documentRef;
    const windowRef = options.windowRef;
    const logger = options.logger || console;
    const dom = options.dom;
    const defaultSettings = options.defaultSettings;
    const exportFileCore = options.exportFileCore;
    const directoryHandleRepository = options.directoryHandleRepository || {};
    const fileSaveStrategies = options.fileSaveStrategies || {};
    const popupMessages = options.popupMessages || {};
    const settingsRepository = options.settingsRepository || {};
    const tabsRepository = options.tabsRepository || {};
    let savedDirectoryHandle = null;
    let selectedDirectoryHandle = null;
    let isExporting = false;

    async function restoreSettings(elements) {
      const settings = await settingsRepository.getSettings();
      const format = normalizeFormat(settings.format);
      const formatInput = documentRef.querySelector(`input[name="format"][value="${format}"]`);
      savedDirectoryHandle = await loadSavedDirectoryHandle();

      if (formatInput) {
        formatInput.checked = true;
      }

      elements.filename.value = settings.filename || defaultSettings.filename;
      elements.closeAfterExport.checked = false;
      elements.savePath.value = getSavePathName(settings);

      if (elements.importLimit) {
        elements.importLimit.value = String(settings.importLimit || defaultSettings.importLimit);
      }
    }

    async function refreshTabsSummary(elements) {
      try {
        const links = await listExportableTabs(elements);

        elements.tabsCount.textContent = String(links.length);
        elements.tabsLabel.textContent = popupMessages.getTabsLabel(links.length);
      } catch (error) {
        elements.tabsCount.textContent = '0';
        elements.tabsLabel.textContent = 'вкладок';
        dom.setStatus(elements, 'error', error.message);
      }
    }

    async function selectSaveDirectory(elements) {
      if (!fileSaveStrategies.supportsDirectoryPicker(windowRef)) {
        dom.setStatus(elements, 'warning', 'Выбор папки недоступен в этом браузере. Файл будет скачан в Загрузки.');
        return;
      }

      try {
        selectedDirectoryHandle = await fileSaveStrategies.selectDirectory(windowRef);
        savedDirectoryHandle = selectedDirectoryHandle;
        elements.savePath.value = selectedDirectoryHandle.name || 'Выбранная папка';

        await settingsRepository.savePathName(elements.savePath.value);
        await saveDirectoryHandle(selectedDirectoryHandle);

        dom.setStatus(elements, 'info', `Папка сохранения: ${elements.savePath.value}`);
      } catch (error) {
        if (error.name !== 'AbortError') {
          logger.error('Directory selection failed:', error);
          dom.setStatus(elements, 'error', 'Не удалось выбрать папку. Попробуйте еще раз.');
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
      dom.setStatus(elements, 'info', 'Готовлю список открытых вкладок...');

      try {
        const links = await listExportableTabs(elements);

        if (links.length === 0) {
          dom.setStatus(elements, 'info', 'Нет открытых страниц, которые можно экспортировать.');
          return;
        }

        const exportFile = exportFileCore.buildExportFile({
          filename: exportOptions.filename,
          format: exportOptions.format,
          links,
        });
        const saveResult = await fileSaveStrategies.saveExportFile(exportFile, {
          documentRef,
          savedDirectoryHandle,
          selectedDirectoryHandle,
          windowRef,
        });
        const closedTabsCount = exportOptions.closeAfterExport
          ? await tabsRepository.closeByIds(links.map((link) => link.id))
          : 0;

        dom.setStatus(
          elements,
          'success',
          popupMessages.buildExportSuccessMessage({
            closedTabsCount,
            closeAfterExport: exportOptions.closeAfterExport,
            exportedTabsCount: exportFile.exportedLinksCount,
            filename: exportFile.fullFilename,
            locationName: saveResult.locationName,
          }),
        );

        await refreshTabsSummary(elements);
      } catch (error) {
        logger.error('Export failed:', error);
        dom.setStatus(elements, 'error', error.message || 'Не удалось экспортировать вкладки.');
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

    function listExportableTabs() {
      if (typeof tabsRepository.listCurrentGroup === 'function') {
        return tabsRepository.listCurrentGroup();
      }

      return tabsRepository.listCurrentWindow();
    }

    function normalizeFormat(format) {
      return ALLOWED_FORMATS.has(format) ? format : defaultSettings.format;
    }

    function getDefaultSaveLocationName() {
      return fileSaveStrategies.DEFAULT_DOWNLOAD_LOCATION_NAME || 'Загрузки';
    }

    function getSavePathName(settings) {
      if (!savedDirectoryHandle) {
        return getDefaultSaveLocationName();
      }

      return settings.savePathName || savedDirectoryHandle.name || getDefaultSaveLocationName();
    }

    async function loadSavedDirectoryHandle() {
      if (typeof directoryHandleRepository.getDirectoryHandle !== 'function') {
        return null;
      }

      try {
        return await directoryHandleRepository.getDirectoryHandle();
      } catch (error) {
        logger.warn('Could not load saved directory handle:', error);

        return null;
      }
    }

    async function saveDirectoryHandle(directoryHandle) {
      if (typeof directoryHandleRepository.saveDirectoryHandle !== 'function') {
        return;
      }

      try {
        await directoryHandleRepository.saveDirectoryHandle(directoryHandle);
      } catch (error) {
        logger.warn('Could not save directory handle:', error);
      }
    }

    function setBusy(elements, value) {
      isExporting = value;
      dom.setExportBusy(elements, value);
    }

    return {
      exportOpenTabs,
      refreshTabsSummary,
      restoreSettings,
      selectSaveDirectory,
    };
  }

  return {
    createExportFlow,
  };
}));
