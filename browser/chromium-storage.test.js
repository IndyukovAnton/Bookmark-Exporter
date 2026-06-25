const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DEFAULT_SETTINGS,
  createSettingsRepository,
} = require('./chromium-storage');

test('settings repository reads storage with default extension settings', async () => {
  const getCalls = [];
  const storageArea = {
    async get(defaults) {
      getCalls.push(defaults);

      return {
        filename: 'sprint-tabs',
      };
    },
  };

  const repository = createSettingsRepository(storageArea);
  const settings = await repository.getSettings();

  assert.deepEqual(getCalls, [DEFAULT_SETTINGS]);
  assert.deepEqual(settings, {
    ...DEFAULT_SETTINGS,
    filename: 'sprint-tabs',
  });
  assert.equal(settings.importLimit, 50);
  assert.equal(settings.closeAfterExport, false);
});

test('settings repository saves export settings without persisting destructive closing as default', async () => {
  const setCalls = [];
  const storageArea = {
    async set(values) {
      setCalls.push(values);
    },
  };

  const repository = createSettingsRepository(storageArea);

  await repository.saveExportSettings({
    closeAfterExport: 1,
    filename: '',
    format: '',
  });

  assert.deepEqual(setCalls, [
    {
      closeAfterExport: false,
      filename: DEFAULT_SETTINGS.filename,
      format: DEFAULT_SETTINGS.format,
    },
  ]);
});

test('settings repository saves selected path name', async () => {
  const setCalls = [];
  const storageArea = {
    async set(values) {
      setCalls.push(values);
    },
  };

  const repository = createSettingsRepository(storageArea);

  await repository.savePathName('Work exports');

  assert.deepEqual(setCalls, [
    { savePathName: 'Work exports' },
  ]);
});

test('settings repository saves normalized import limit', async () => {
  const setCalls = [];
  const storageArea = {
    async set(values) {
      setCalls.push(values);
    },
  };

  const repository = createSettingsRepository(storageArea);

  await repository.saveImportLimit('25');
  await repository.saveImportLimit('0');
  await repository.saveImportLimit('not-a-number');

  assert.deepEqual(setCalls, [
    { importLimit: 25 },
    { importLimit: DEFAULT_SETTINGS.importLimit },
    { importLimit: DEFAULT_SETTINGS.importLimit },
  ]);
});
