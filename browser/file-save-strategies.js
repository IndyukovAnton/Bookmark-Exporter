(function attachFileSaveStrategies(root, factory) {
  const fileSaveStrategies = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = fileSaveStrategies;
  }

  if (root) {
    root.BookmarkExporterFileSaveStrategies = fileSaveStrategies;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createFileSaveStrategies() {
  const DEFAULT_DOWNLOAD_LOCATION_NAME = 'Загрузки';
  const DEFAULT_PICKED_DIRECTORY_NAME = 'Выбранная папка';

  function supportsDirectoryPicker(windowRef) {
    return Boolean(windowRef && typeof windowRef.showDirectoryPicker === 'function');
  }

  async function selectDirectory(windowRef) {
    if (!supportsDirectoryPicker(windowRef)) {
      throw new Error('Выбор папки недоступен в этом браузере.');
    }

    return windowRef.showDirectoryPicker();
  }

  async function writeExportFile(directoryHandle, exportFile) {
    const fileHandle = await directoryHandle.getFileHandle(exportFile.fullFilename, { create: true });
    const writable = await fileHandle.createWritable();

    await writable.write(exportFile.content);
    await writable.close();
  }

  async function hasDirectoryWritePermission(directoryHandle) {
    const permissionOptions = { mode: 'readwrite' };

    if (typeof directoryHandle.queryPermission === 'function') {
      const permission = await directoryHandle.queryPermission(permissionOptions);

      if (permission === 'granted') {
        return true;
      }

      if (permission === 'denied') {
        return false;
      }
    }

    if (typeof directoryHandle.requestPermission === 'function') {
      return await directoryHandle.requestPermission(permissionOptions) === 'granted';
    }

    return true;
  }

  function downloadExportFile(exportFile, options = {}) {
    const documentRef = options.documentRef || document;
    const windowRef = options.windowRef || window;
    const blobCtor = options.BlobCtor || Blob;
    const urlApi = options.urlApi || URL;
    const blob = new blobCtor([exportFile.content], { type: exportFile.mimeType });
    const url = urlApi.createObjectURL(blob);
    const link = documentRef.createElement('a');

    link.href = url;
    link.download = exportFile.fullFilename;
    documentRef.body.appendChild(link);
    link.click();
    link.remove();

    if (windowRef && typeof windowRef.setTimeout === 'function') {
      windowRef.setTimeout(() => urlApi.revokeObjectURL(url), 1000);
      return;
    }

    urlApi.revokeObjectURL(url);
  }

  async function saveExportFile(exportFile, options = {}) {
    const directoryHandle = options.selectedDirectoryHandle || options.savedDirectoryHandle;
    const windowRef = options.windowRef;

    if (directoryHandle && supportsDirectoryPicker(windowRef)) {
      const canWriteDirectory = await hasDirectoryWritePermission(directoryHandle);

      if (canWriteDirectory) {
        await writeExportFile(directoryHandle, exportFile);

        return {
          locationName: directoryHandle.name || DEFAULT_PICKED_DIRECTORY_NAME,
          usedDirectoryPicker: true,
        };
      }
    }

    const downloadFile = options.downloadFile || ((file) => downloadExportFile(file, options));

    await downloadFile(exportFile);

    return {
      locationName: DEFAULT_DOWNLOAD_LOCATION_NAME,
      usedDirectoryPicker: false,
    };
  }

  return {
    DEFAULT_DOWNLOAD_LOCATION_NAME,
    DEFAULT_PICKED_DIRECTORY_NAME,
    downloadExportFile,
    hasDirectoryWritePermission,
    saveExportFile,
    selectDirectory,
    supportsDirectoryPicker,
    writeExportFile,
  };
}));
