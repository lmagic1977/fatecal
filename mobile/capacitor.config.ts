import type { CapacitorConfig } from '@capacitor/cli';

// The app shows fatecal.com inside a native shell, so the website and the apps stay in step.
// Native extras (phone calendar, local reminders) are called from the site through Capacitor's bridge.
const config: CapacitorConfig = {
  appId: 'com.fatecal.app',
  appName: 'FateCal',
  webDir: 'www',
  server: {
    url: 'https://fatecal.com',
    cleartext: false,
    allowNavigation: ['fatecal.com', '*.fatecal.com', 'checkout.stripe.com', 'billing.stripe.com'],
  },
  appendUserAgent: 'FateCalApp',
  backgroundColor: '#F6F4FD',
  ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: false, scheme: 'FateCal' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#F6F4FD', showSpinner: false },
  },
};
export default config;
