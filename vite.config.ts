import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

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
        admin: resolve(__dirname, 'src/admin/main.ts'),
        visitor: resolve(__dirname, 'src/visitor.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? '[name][extname]' : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
