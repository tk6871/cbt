// Serve only the prepared public preview directory. Missing assets must return 404.
export default {
  envDir: false,
  appType: 'mpa',
  preview: { cors: false, host: '127.0.0.1', port: 4360, strictPort: true, proxy: { '/api': 'http://127.0.0.1:4361' } },
};
