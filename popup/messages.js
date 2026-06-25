(function attachPopupMessages(root, factory) {
  const popupMessages = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = popupMessages;
  }

  if (root) {
    root.BookmarkExporterPopupMessages = popupMessages;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createPopupMessages() {
  const DOWNLOADS_LOCATION_NAME = 'Загрузки';

  function getTabsLabel(count) {
    const lastDigit = count % 10;
    const lastTwoDigits = count % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return 'вкладок';
    }

    if (lastDigit === 1) {
      return 'вкладка';
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return 'вкладки';
    }

    return 'вкладок';
  }

  function formatSaveLocation(locationName) {
    if (!locationName || locationName === DOWNLOADS_LOCATION_NAME) {
      return 'в Загрузки';
    }

    return `в папку "${locationName}"`;
  }

  function buildExportSuccessMessage({
    closedTabsCount = 0,
    closeAfterExport,
    exportedTabsCount,
    filename,
    locationName,
  }) {
    const closedPart = closeAfterExport
      ? ` Закрыто вкладок: ${closedTabsCount}.`
      : '';

    return `Экспортировано вкладок: ${exportedTabsCount}. Файл "${filename}" сохранен ${formatSaveLocation(locationName)}.${closedPart}`;
  }

  return {
    buildExportSuccessMessage,
    formatSaveLocation,
    getTabsLabel,
  };
}));
