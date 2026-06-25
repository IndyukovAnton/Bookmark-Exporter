const assert = require('node:assert/strict');
const test = require('node:test');

const {
  saveExportFile,
  supportsDirectoryPicker,
} = require('./file-save-strategies');

test('supportsDirectoryPicker detects File System Access API availability', () => {
  assert.equal(supportsDirectoryPicker({ showDirectoryPicker() {} }), true);
  assert.equal(supportsDirectoryPicker({}), false);
  assert.equal(supportsDirectoryPicker(undefined), false);
});

test('saveExportFile writes into selected directory when File System Access API is available', async () => {
  const calls = [];
  const directoryHandle = {
    name: 'Work exports',
    async getFileHandle(filename, options) {
      calls.push({ filename, options });

      return {
        async createWritable() {
          return {
            async write(content) {
              calls.push({ content });
            },
            async close() {
              calls.push({ closed: true });
            },
          };
        },
      };
    },
  };

  const result = await saveExportFile(
    { content: 'content', fullFilename: 'tabs.md', mimeType: 'text/markdown' },
    {
      selectedDirectoryHandle: directoryHandle,
      windowRef: { showDirectoryPicker() {} },
    },
  );

  assert.deepEqual(calls, [
    { filename: 'tabs.md', options: { create: true } },
    { content: 'content' },
    { closed: true },
  ]);
  assert.deepEqual(result, {
    locationName: 'Work exports',
    usedDirectoryPicker: true,
  });
});

test('saveExportFile falls back to browser download when directory picker is unavailable', async () => {
  const downloadedFiles = [];
  const exportFile = { content: 'content', fullFilename: 'tabs.txt', mimeType: 'text/plain' };

  const result = await saveExportFile(exportFile, {
    downloadFile(file) {
      downloadedFiles.push(file);
    },
    windowRef: {},
  });

  assert.deepEqual(downloadedFiles, [exportFile]);
  assert.deepEqual(result, {
    locationName: 'Загрузки',
    usedDirectoryPicker: false,
  });
});
