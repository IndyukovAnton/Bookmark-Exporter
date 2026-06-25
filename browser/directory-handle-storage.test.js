const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createDirectoryHandleRepository,
} = require('./directory-handle-storage');

function createFakeIndexedDb() {
  const stores = new Map();
  let db = null;

  return {
    open() {
      const request = {};

      queueMicrotask(() => {
        const needsUpgrade = db === null;
        db = createFakeDb(stores);
        request.result = db;

        if (needsUpgrade && typeof request.onupgradeneeded === 'function') {
          request.onupgradeneeded({ target: request });
        }

        if (typeof request.onsuccess === 'function') {
          request.onsuccess({ target: request });
        }
      });

      return request;
    },
  };
}

function createFakeDb(stores) {
  return {
    objectStoreNames: {
      contains(storeName) {
        return stores.has(storeName);
      },
    },
    createObjectStore(storeName) {
      stores.set(storeName, new Map());
    },
    transaction(storeName) {
      return {
        objectStore() {
          const store = stores.get(storeName);

          return {
            get(key) {
              return createSuccessfulRequest(() => store.get(key));
            },
            put(value, key) {
              return createSuccessfulRequest(() => {
                store.set(key, value);

                return key;
              });
            },
          };
        },
      };
    },
    close() {},
  };
}

function createSuccessfulRequest(resolveValue) {
  const request = {};

  queueMicrotask(() => {
    request.result = resolveValue();

    if (typeof request.onsuccess === 'function') {
      request.onsuccess({ target: request });
    }
  });

  return request;
}

test('directory handle repository returns null when IndexedDB is unavailable', async () => {
  const repository = createDirectoryHandleRepository(null);

  assert.equal(await repository.getDirectoryHandle(), null);
});

test('directory handle repository stores and restores selected directory handle', async () => {
  const repository = createDirectoryHandleRepository(createFakeIndexedDb());
  const directoryHandle = { name: 'Work exports' };

  await repository.saveDirectoryHandle(directoryHandle);

  assert.equal(await repository.getDirectoryHandle(), directoryHandle);
});
