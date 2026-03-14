import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dreddi.edit',
  appName: 'Edit App',
  webDir: '../../Web-App/dashboard/dist',
  ios: {
    path: '../../IOS_App',
  },
  android: {
    path: '../../Google-App',
  },
};

export default config;
