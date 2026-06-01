const { defaultSettings } = require('../config/defaultSettings');

function createSettingsRepository(database) {
  return {
    getSettings() {
      const rows = database.all('SELECT key, value FROM settings');
      const stored = rows.reduce((accumulator, row) => {
        accumulator[row.key] = JSON.parse(row.value);
        return accumulator;
      }, {});

      return {
        ...defaultSettings,
        ...stored
      };
    },
    saveSettings(payload = {}) {
      const nextSettings = {
        ...defaultSettings,
        ...this.getSettings(),
        ...payload
      };

      const transaction = database.transaction((settingsObject) => {
        Object.entries(settingsObject).forEach(([key, value]) => {
          database.run(
            `
              INSERT INTO settings (key, value)
              VALUES (?, ?)
              ON CONFLICT(key) DO UPDATE SET value = excluded.value
            `,
            [key, JSON.stringify(value)]
          );
        });
      });

      transaction(nextSettings);
      return nextSettings;
    }
  };
}

module.exports = {
  createSettingsRepository
};
