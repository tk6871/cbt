import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  plugins: [vue()],
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
        chunkFileNames: 'chunks/[name]-v351.js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? '[name][extname]' : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
