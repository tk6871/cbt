import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tk6871.cbt',
  appName: '산업기사 통합 CBT',
  webDir: '.android-web',
  backgroundColor: '#0d1622',
  android: {
    backgroundColor: '#0d1622',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
      backgroundColor: '#00000000',
    },
  },
};

export default config;
