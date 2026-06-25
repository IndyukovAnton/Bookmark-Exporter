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
    savePathName: '',
  };

  function createSettingsRepository(storageArea) {
    async function getSettings() {
      if (!storageArea || typeof storageArea.get !== 'function') {
        throw new Error('Нет доступа к настройкам расширения.');
      }

      const settings = await storageArea.get(DEFAULT_SETTINGS);

      return {
        ...DEFAULT_SETTINGS,
        ...settings,
      };
    }

    async function saveExportSettings(settings) {
      if (!storageArea || typeof storageArea.set !== 'function') {
        throw new Error('Нет доступа к сохранению настроек расширения.');
      }

      await storageArea.set({
        closeAfterExport: Boolean(settings.closeAfterExport),
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

    return {
      getSettings,
      saveExportSettings,
      savePathName,
    };
  }

  return {
    DEFAULT_SETTINGS,
    createSettingsRepository,
  };
}));
