import type { CapacitorConfig } from '@capacitor/cli';
import app from './ios-app.json';

const config: CapacitorConfig = {
  appId: app.appId,
  appName: '中国昼夜地图',
  webDir: 'dist-ios',
  backgroundColor: '#f4f8fa',
  loggingBehavior: 'debug',
  ios: { contentInset: 'never', preferredContentMode: 'mobile', allowsLinkPreview: false },
  plugins: { StatusBar: { style: 'LIGHT', overlaysWebView: true } },
};
export default config;
