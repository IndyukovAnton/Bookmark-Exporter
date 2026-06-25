(function attachDirectoryHandleStorage(root, factory) {
  const directoryHandleStorage = factory();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = directoryHandleStorage;
  }

  if (root) {
    root.BookmarkExporterDirectoryHandleStorage = directoryHandleStorage;
  }
}(typeof globalThis !== 'undefined' ? globalThis : undefined, function createDirectoryHandleStorage() {
  const DB_NAME = 'bookmark-exporter-settings';
  const DB_VERSION = 1;
  const STORE_NAME = 'directory-handles';
  const SAVE_DIRECTORY_KEY = 'save-directory';

  function createDirectoryHandleRepository(indexedDbRef) {
    async function getDirectoryHandle() {
      if (!canUseIndexedDb(indexedDbRef)) {
        return null;
      }

      const db = await openDatabase(indexedDbRef);

      try {
        const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME);

        return await requestToPromise(store.get(SAVE_DIRECTORY_KEY));
      } finally {
        closeDatabase(db);
      }
    }

    async function saveDirectoryHandle(directoryHandle) {
      if (!directoryHandle || !canUseIndexedDb(indexedDbRef)) {
        return;
      }

      const db = await openDatabase(indexedDbRef);

      try {
        const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);

        await requestToPromise(store.put(directoryHandle, SAVE_DIRECTORY_KEY));
      } finally {
        closeDatabase(db);
      }
    }

    return {
      getDirectoryHandle,
      saveDirectoryHandle,
    };
  }

  function canUseIndexedDb(indexedDbRef) {
    return Boolean(indexedDbRef && typeof indexedDbRef.open === 'function');
  }

  function openDatabase(indexedDbRef) {
    return new Promise((resolve, reject) => {
      const request = indexedDbRef.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть хранилище папки сохранения.'));
    });
  }

  function requestToPromise(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось обновить хранилище папки сохранения.'));
    });
  }

  function closeDatabase(db) {
    if (db && typeof db.close === 'function') {
      db.close();
    }
  }

  return {
    DB_NAME,
    DB_VERSION,
    SAVE_DIRECTORY_KEY,
    STORE_NAME,
    createDirectoryHandleRepository,
  };
}));
