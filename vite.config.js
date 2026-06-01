const { defineConfig } = require('vite');
const vuePlugin = require('@vitejs/plugin-vue');
const vuetifyPlugin = require('vite-plugin-vuetify');
const { transformAssetUrls } = require('vuetify/lib/util/helpers');
const path = require('path');

const vue = vuePlugin.default || vuePlugin;
const vuetify = vuetifyPlugin.default || vuetifyPlugin;

module.exports = defineConfig({
  plugins: [
    vue({
      template: {
        transformAssetUrls
      }
    }),
    vuetify({
      autoImport: true
    })
  ],
  base: './',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  }
});
