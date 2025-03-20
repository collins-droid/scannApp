import { Stack, Redirect } from 'expo-router';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, StyleSheet } from 'react-native';
import { Camera } from 'expo-camera';
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
        
        // Request camera permission early
        try {
          const { status } = await Camera.requestCameraPermissionsAsync();
          logger.info('Camera permission status:', status);
        } catch (cameraError) {
          // Don't fail the app initialization if camera permissions fail
          // This allows the app to work even if the barcode scanner is not available
          logger.warn('Camera permission request failed, continuing without camera access', cameraError);
        }
        
        // Initialize USB service
        try {
          const usbService = USBService.getInstance();
          const connected = await usbService.connect();
          logger.info('Services initialized', { usbConnected: connected });
        } catch (usbError) {
          // Don't fail if USB initialization fails
          logger.warn('USB service initialization failed, continuing without USB connectivity', usbError);
        }
        
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
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
});
