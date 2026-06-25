(function attachChromiumStorage(root, factory) {
  const chromiumStorage = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = chromiumStorage;
  }

  if (root) {
    root.BookmarkExporterChromiumStorage = chromiumStorage;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createChromiumStorage() {
  const DEFAULT_SETTINGS = {
    closeAfterExport: false,
    filename: 'open-tabs',
    format: 'md',
    importLimit: 50,
    savePathName: '',
  };

  function normalizeImportLimit(value) {
    const limit = Number(value);

    if (!Number.isInteger(limit) || limit < 1) {
      return DEFAULT_SETTINGS.importLimit;
    }

    return limit;
  }

  function createSettingsRepository(storageArea) {
    async function getSettings() {
      if (!storageArea || typeof storageArea.get !== 'function') {
        throw new Error('Нет доступа к настройкам расширения.');
      }

      const settings = await storageArea.get(DEFAULT_SETTINGS);

      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
      };

      return {
        ...mergedSettings,
        importLimit: normalizeImportLimit(mergedSettings.importLimit),
      };
    }

    async function saveExportSettings(settings) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        throw new Error('Нет доступа к сохранению настроек расширения.');
      }

      await storageArea.set({
        closeAfterExport: DEFAULT_SETTINGS.closeAfterExport,
        filename: settings.filename || DEFAULT_SETTINGS.filename,
        format: settings.format || DEFAULT_SETTINGS.format,
      });
    }

    async function savePathName(savePathName) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        throw new Error('Нет доступа к сохранению настроек расширения.');
      }

      await storageArea.set({ savePathName });
    }

    async function saveImportLimit(importLimit) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        throw new Error('Нет доступа к сохранению настроек расширения.');
      }

      await storageArea.set({
        importLimit: normalizeImportLimit(importLimit),
      });
    }

    return {
      getSettings,
      saveExportSettings,
      saveImportLimit,
      savePathName,
    };
  }

  return {
    DEFAULT_SETTINGS,
    createSettingsRepository,
    normalizeImportLimit,
  };
}));
