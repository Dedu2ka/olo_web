const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'node tests/server.js', port: 4173, reuseExistingServer: !process.env.CI },
  reporter: 'list'
});
