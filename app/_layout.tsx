import { Stack } from 'expo-router';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import USBService from '../services/USBService';
import LoggingService from '../services/LoggingService';
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we initialize services
SplashScreen.preventAutoHideAsync();

/**
 * Root layout that initializes services and provides the Stack navigator
 */
export default function RootLayout() {
  const [isReady, setIsReady] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  
  // Initialize services
  useEffect(() => {
    async function initServices() {
      try {
        const logger = LoggingService.getInstance();
        logger.info('Initializing services');
        
        const usbService = USBService.getInstance();
        const connected = await usbService.connect();
        
        logger.info('Services initialized', { usbConnected: connected });
        
        setIsReady(true);
      } catch (err) {
        console.error('Failed to initialize services', err);
        setError('Failed to initialize application services. Please restart the app.');
        setIsReady(true);
      } finally {
        // Hide splash screen once we're done
        await SplashScreen.hideAsync();
      }
    }

    initServices();
  }, []);

  // If there was an error during initialization, show it
  if (error) {
    return <Text style={{ padding: 20, color: 'red' }}>{error}</Text>;
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </>
  );
}
