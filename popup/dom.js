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
      copyDiagnosticsBtn: documentRef.getElementById('copyDiagnosticsBtn'),
      exportPanel: documentRef.getElementById('exportPanel'),
      exportTabBtn: documentRef.getElementById('exportTabBtn'),
      exportBtn: documentRef.getElementById('exportBtn'),
      filename: documentRef.getElementById('filename'),
      importBtn: documentRef.getElementById('importBtn'),
      importFile: documentRef.getElementById('importFile'),
      importFileName: documentRef.getElementById('importFileName'),
      importLimit: documentRef.getElementById('importLimit'),
      importPanel: documentRef.getElementById('importPanel'),
      importTabBtn: documentRef.getElementById('importTabBtn'),
      importText: documentRef.getElementById('importText'),
      savePath: documentRef.getElementById('savePath'),
      selectImportFileBtn: documentRef.getElementById('selectImportFileBtn'),
      selectPathBtn: documentRef.getElementById('selectPathBtn'),
      settingsPanel: documentRef.getElementById('settingsPanel'),
      settingsTabBtn: documentRef.getElementById('settingsTabBtn'),
      status: documentRef.getElementById('status'),
      tabsCount: documentRef.getElementById('tabsCount'),
      tabsLabel: documentRef.getElementById('tabsLabel'),
    };
  }

  function showMode(elements, mode) {
    const activeMode = mode === 'import' || mode === 'settings' ? mode : 'export';

    setModeState(elements.exportPanel, elements.exportTabBtn, activeMode === 'export');
    setModeState(elements.importPanel, elements.importTabBtn, activeMode === 'import');
    setModeState(elements.settingsPanel, elements.settingsTabBtn, activeMode === 'settings');
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

  function setModeState(panel, tab, isActive) {
    if (panel) {
      panel.hidden = !isActive;
    }

    if (tab) {
      tab.className = isActive ? 'mode-tab mode-tab--active' : 'mode-tab';
    }

    setAttribute(tab, 'aria-selected', String(isActive));
  }

  return {
    getElements,
    setExportBusy,
    setImportBusy,
    setStatus,
    showMode,
  };
}));
