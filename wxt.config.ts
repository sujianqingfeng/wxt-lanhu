import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  outDir: 'output',
  webExt: {
    // Dev 时不要自动启动浏览器（Chrome/Firefox 等）
    disabled: true,
  },
  dev: {
    server: {
      port: 5000,
    },
  },
  manifest: {
    name: 'Lanhu Layer Tree',
    description: 'Browse Lanhu SketchJSON layer tree and export descendants.',
    host_permissions: ['https://lanhuapp.com/*', 'https://alipic.lanhuapp.com/*'],
    permissions: ['tabs', 'storage'],
  },
});
