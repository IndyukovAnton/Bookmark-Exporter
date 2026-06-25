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
});

test('settings repository saves export settings with normalized default values', async () => {
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
      closeAfterExport: true,
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
