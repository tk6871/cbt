import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const buildVersion = '420';

export default defineConfig({
  base: './',
  define: {
    __CBT_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      outDir: 'modern/pwa-build',
      injectRegister: false,
      registerType: 'prompt',
      manifest: false,
      injectManifest: {
        injectionPoint: undefined,
        rollupFormat: 'iife',
        minify: true,
        sourcemap: false,
      },
    }),
  ],
  build: {
    outDir: 'modern',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      input: {
        admin: resolve(projectRoot, 'src/admin/main.ts'),
        visitor: resolve(projectRoot, 'src/visitor.ts'),
        cbt: resolve(projectRoot, 'src/cbt/main.ts'),
        mobile: resolve(projectRoot, 'src/cbt/mobile.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: `chunks/[name]-v${buildVersion}.js`,
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? '[name][extname]' : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
