let selectedDirectoryHandle = null;
let isExporting = false;

const DEFAULT_SETTINGS = {
  closeAfterExport: false,
  filename: 'open-tabs',
  format: 'md',
  savePathName: '',
};

const core = window.BookmarkExporterCore;

document.addEventListener('DOMContentLoaded', async () => {
  const elements = getElements();

  await restoreSettings(elements);
  bindEvents(elements);
  await refreshTabsSummary(elements);
});

function getElements() {
  return {
    closeAfterExport: document.getElementById('closeAfterExport'),
    exportBtn: document.getElementById('exportBtn'),
    filename: document.getElementById('filename'),
    savePath: document.getElementById('savePath'),
    selectPathBtn: document.getElementById('selectPathBtn'),
    status: document.getElementById('status'),
    tabsCount: document.getElementById('tabsCount'),
    tabsLabel: document.getElementById('tabsLabel'),
  };
}

async function restoreSettings(elements) {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const formatInput = document.querySelector(`input[name="format"][value="${settings.format}"]`);

  if (formatInput) {
    formatInput.checked = true;
  }

  elements.filename.value = settings.filename || DEFAULT_SETTINGS.filename;
  elements.closeAfterExport.checked = Boolean(settings.closeAfterExport);
  elements.savePath.value = settings.savePathName || 'Загрузки';
}

function bindEvents(elements) {
  elements.selectPathBtn.addEventListener('click', () => selectSaveDirectory(elements));
  elements.exportBtn.addEventListener('click', () => exportOpenTabs(elements));
}

async function refreshTabsSummary(elements) {
  try {
    const links = await core.fetchOpenTabs(chrome.tabs);
    elements.tabsCount.textContent = String(links.length);
    elements.tabsLabel.textContent = getTabsLabel(links.length);
  } catch (error) {
    elements.tabsCount.textContent = '0';
    elements.tabsLabel.textContent = 'вкладок';
    setStatus(elements, 'error', error.message);
  }
}

async function selectSaveDirectory(elements) {
  if (!window.showDirectoryPicker) {
    setStatus(elements, 'warning', 'Выбор папки недоступен в этом браузере. Файл будет скачан в Загрузки.');
    return;
  }

  try {
    selectedDirectoryHandle = await window.showDirectoryPicker();
    elements.savePath.value = selectedDirectoryHandle.name || 'Выбранная папка';

    await chrome.storage.sync.set({
      savePathName: elements.savePath.value,
    });

    setStatus(elements, 'info', `Папка сохранения: ${elements.savePath.value}`);
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error('Directory selection failed:', error);
      setStatus(elements, 'error', 'Не удалось выбрать папку. Попробуйте еще раз.');
    }
  }
}

async function exportOpenTabs(elements) {
  if (isExporting) {
    return;
  }

  const format = document.querySelector('input[name="format"]:checked').value;
  const filename = elements.filename.value.trim() || DEFAULT_SETTINGS.filename;
  const closeAfterExport = elements.closeAfterExport.checked;

  await chrome.storage.sync.set({
    closeAfterExport,
    filename,
    format,
  });

  setBusy(elements, true);
  setStatus(elements, 'info', 'Готовлю список открытых вкладок...');

  try {
    const links = await core.fetchOpenTabs(chrome.tabs);

    if (links.length === 0) {
      setStatus(elements, 'info', 'Нет открытых страниц, которые можно экспортировать.');
      return;
    }

    const exportFile = core.buildExportFile({
      filename,
      format,
      links,
    });

    await saveFile(exportFile);

    let closedTabsCount = 0;

    if (closeAfterExport) {
      closedTabsCount = await closeExportedTabs(links);
    }

    const savedLocation = selectedDirectoryHandle
      ? `в папку "${selectedDirectoryHandle.name}"`
      : 'в Загрузки';
    const closedPart = closeAfterExport
      ? ` Закрыто вкладок: ${closedTabsCount}.`
      : '';

    setStatus(
      elements,
      'success',
      `Экспортировано вкладок: ${links.length}. Файл "${exportFile.fullFilename}" сохранен ${savedLocation}.${closedPart}`,
    );

    await refreshTabsSummary(elements);
  } catch (error) {
    console.error('Export failed:', error);
    setStatus(elements, 'error', error.message || 'Не удалось экспортировать вкладки.');
  } finally {
    setBusy(elements, false);
  }
}

async function saveFile(exportFile) {
  if (selectedDirectoryHandle && window.showDirectoryPicker) {
    const fileHandle = await selectedDirectoryHandle.getFileHandle(exportFile.fullFilename, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(exportFile.content);
    await writable.close();

    return;
  }

  downloadFile(exportFile);
}

function downloadFile(exportFile) {
  const blob = new Blob([exportFile.content], { type: exportFile.mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = exportFile.fullFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function closeExportedTabs(links) {
  const tabIds = links
    .map((link) => link.id)
    .filter((id) => typeof id === 'number');
  let closedTabsCount = 0;

  for (const tabId of tabIds) {
    try {
      await chrome.tabs.remove(tabId);
      closedTabsCount += 1;
    } catch (error) {
      console.warn(`Could not close tab ${tabId}:`, error);
    }
  }

  return closedTabsCount;
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
