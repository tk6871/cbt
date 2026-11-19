import {defineConfig} from 'vite';

export default defineConfig({
  publicDir: false,
  define: {'process.env.NODE_ENV': JSON.stringify('test')},
  build: {
    outDir: 'work',
    emptyOutDir: false,
    lib: {entry:'tools/sync-test-harness.ts', name:'CBTSyncFixture', formats:['iife'], fileName:()=>'sync-test-harness.js'},
  },
});
