import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.violetapp.messenger',
  appName: 'VioletApp',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;