import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import { zodCommentCompat } from './tools/zod-comment-compat.mjs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const buildVersion = '840';
const analyzeBundle = process.env.npm_lifecycle_event === 'analyze';

export default defineConfig({
  base: './',
  server: { proxy: { '/api': 'http://127.0.0.1:4361' } },
  preview: { proxy: {} },
  define: {
    __CBT_BUILD_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    zodCommentCompat(),
    {
      name: 'check-react-production-modules',
      generateBundle(_, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          for (const id of Object.keys(output.modules)) {
            if (/\.vue(?:\?|$)|\/node_modules\/(?:vue|@vue|@vueuse)\//.test(id))
              this.error('Unexpected Vue runtime in '+output.fileName+': '+id);
          }
        }
      },
    },
    react({ include: /\.tsx$/ }),
    {
      name: 'cbt-dev-entries',
      apply: 'serve',
      transformIndexHtml: {
        order: 'pre',
        handler(html, { path }) {
          if (!['/', '/index.html', '/jewelry.html', '/admin.html'].includes(path)) return;
          // Static hosting uses versioned bundles. Vite must serve the source modules for HMR.
          return html
            .replace(/<link\b[^>]*\bhref="modern\/[^"]+"[^>]*>/g, '')
            .replace(/\sdata-entry="modern\/cbt\.js\?v=\d+"/, '')
            .replace(/src="data\/study-start\.js\?v=\d+"/, 'type="module" src="/src/cbt/main.ts"')
            .replace(/src="modern\/admin\.js\?v=\d+"/, 'src="/src/admin/admin.ts"')
            .replace(/'\.\/modern\/visitor\.js\?v=\d+'/, "'/src/visitor.ts'")
            .replace(/<script src="cloud-config\.js\?v=\d+"><\/script>/,
              existsSync(resolve(projectRoot, 'cloud-config.local.js')) ? '<script src="/cloud-config.local.js"></script>' : '');
        },
      },
    },
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
    analyzeBundle && visualizer({
      filename: `work/bundle-report-v${buildVersion}.html`,
      gzipSize: true,
      brotliSize: true,
      open: false,
      template: 'treemap',
    }),
  ],
  build: {
    outDir: 'modern',
    manifest: 'pwa-build-manifest.json',
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: true,
    rollupOptions: {
      // HTML adds a version query to entries. Shared lazy modules must not import
      // an unversioned app entry and mount a second app into the same root.
      preserveEntrySignatures: 'strict',
      input: {
        admin: resolve(projectRoot, 'src/admin/admin.ts'),
        visitor: resolve(projectRoot, 'src/visitor.ts'),
        cbt: resolve(projectRoot, 'src/cbt/main.ts'),
        mobile: resolve(projectRoot, 'src/cbt/mobile.ts')
      },
      output: {
        manualChunks: (id) => {
          if (id.endsWith('/data/problem-image-index.json')) return 'problem-image-index';
          // The entry awaits the energy layout during cold starts with that bank selected.
          // Both use the fingerprint, so it must be available before the entry finishes.
          if (id.endsWith('/src/cbt/questionFingerprint.ts')) return 'question-fingerprint';
        },
        entryFileNames: '[name].js',
        chunkFileNames: `chunks/[name]-v${buildVersion}.js`,
        // Lazy component styles change their scoped selectors when the component changes.
        // Version their URLs too, so an older service worker cannot mix old CSS
        // with a new component chunk. The entry CSS uses a versioned HTML query.
        assetFileNames: (assetInfo) => assetInfo.name === 'main.css' ? 'cbt.css' : assetInfo.name === 'admin.css' ? 'admin.css' : assetInfo.name?.endsWith('.css') ? `[name]-v${buildVersion}[extname]` : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
