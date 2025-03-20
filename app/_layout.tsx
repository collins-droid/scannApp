import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import LoggingService from '../services/LoggingService';
import USBService from '../services/USBService';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Initialize services
  useEffect(() => {
    const logger = LoggingService.getInstance();
    const usbService = USBService.getInstance();
    
    logger.info('App initialized');

    // Attempt to connect to USB device on startup
    const attemptConnection = async () => {
      try {
        const connected = await usbService.connect();
        logger.info(`Auto-connect to USB device: ${connected ? 'success' : 'failed'}`);
      } catch (error) {
        logger.error('Error connecting to USB device', error);
      }
    };

    attemptConnection();

    // Clean up when app is unmounted
    return () => {
      logger.info('App shutting down');
      if (usbService.isDeviceConnected()) {
        usbService.disconnect();
        logger.info('USB disconnected on app shutdown');
      }
    };
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
