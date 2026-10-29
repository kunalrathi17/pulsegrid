import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.enterprise.taskflow',
  appName: 'PulseGrid',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;