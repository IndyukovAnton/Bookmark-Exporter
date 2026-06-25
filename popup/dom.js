(function attachPopupDom(root, factory) {
  const popupDom = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = popupDom;
  }

  if (root) {
    root.BookmarkExporterPopupDom = popupDom;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createPopupDom() {
  function getElements(documentRef) {
    return {
      closeAfterExport: documentRef.getElementById('closeAfterExport'),
      exportPanel: documentRef.getElementById('exportPanel'),
      exportTabBtn: documentRef.getElementById('exportTabBtn'),
      exportBtn: documentRef.getElementById('exportBtn'),
      filename: documentRef.getElementById('filename'),
      importBtn: documentRef.getElementById('importBtn'),
      importFile: documentRef.getElementById('importFile'),
      importFileName: documentRef.getElementById('importFileName'),
      importPanel: documentRef.getElementById('importPanel'),
      importTabBtn: documentRef.getElementById('importTabBtn'),
      importText: documentRef.getElementById('importText'),
      savePath: documentRef.getElementById('savePath'),
      selectImportFileBtn: documentRef.getElementById('selectImportFileBtn'),
      selectPathBtn: documentRef.getElementById('selectPathBtn'),
      status: documentRef.getElementById('status'),
      tabsCount: documentRef.getElementById('tabsCount'),
      tabsLabel: documentRef.getElementById('tabsLabel'),
    };
  }

  function showMode(elements, mode) {
    const isImportMode = mode === 'import';

    elements.exportPanel.hidden = isImportMode;
    elements.importPanel.hidden = !isImportMode;
    elements.exportTabBtn.className = isImportMode ? 'mode-tab' : 'mode-tab mode-tab--active';
    elements.importTabBtn.className = isImportMode ? 'mode-tab mode-tab--active' : 'mode-tab';
    setAttribute(elements.exportTabBtn, 'aria-selected', String(!isImportMode));
    setAttribute(elements.importTabBtn, 'aria-selected', String(isImportMode));
  }

  function setExportBusy(elements, value) {
    elements.exportBtn.disabled = value;
    elements.exportBtn.textContent = value ? 'Экспорт...' : 'Экспортировать вкладки';
  }

  function setImportBusy(elements, value) {
    elements.importBtn.disabled = value;
    elements.importBtn.textContent = value ? 'Открываю...' : 'Открыть ссылки';
  }

  function setStatus(elements, type, message) {
    elements.status.hidden = false;
    elements.status.className = `status status--${type}`;
    elements.status.textContent = message;
  }

  function setAttribute(element, name, value) {
    if (element && typeof element.setAttribute === 'function') {
      element.setAttribute(name, value);
    }
  }

  return {
    getElements,
    setExportBusy,
    setImportBusy,
    setStatus,
    showMode,
  };
}));
