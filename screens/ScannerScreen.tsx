import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar, Alert } from 'react-native';
import { Audio } from 'expo-av';
import ExpoCompatibleScanner from '../components/ExpoCompatibleScanner';
import USBConnectionStatus from '../components/USBConnectionStatus';
import TransmissionStatus from '../components/TransmissionStatus';
import LoggingService from '../services/LoggingService';
import BarcodeService from '../services/BarcodeService';
import StorageService from '../services/StorageService';
import USBService from '../services/USBService';
import { AppSettings } from '../components/SettingsForm';

// Import the sound file using a static import with proper path resolution
const scannerBeepSound = require('../assets/sound/store-scanner-beep-90395.mp3');

/**
 * Main scanner screen that shows the camera for barcode scanning
 */
const ScannerScreen: React.FC = () => {
  const [currentBarcode, setCurrentBarcode] = useState<string | undefined>(undefined);
  const [autoSend, setAutoSend] = useState<boolean>(true);
  const [lastSentBarcode, setLastSentBarcode] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const logger = LoggingService.getInstance();
  const barcodeService = BarcodeService.getInstance();
  const storageService = StorageService.getInstance();
  const usbService = USBService.getInstance();

  // Load scanner beep sound
  useEffect(() => {
    async function loadSound() {
      try {
        logger.info('Loading scanner beep sound');
        
        // Initialize Audio
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        
        // Load the sound file
        const { sound } = await Audio.Sound.createAsync(scannerBeepSound);
        setSound(sound);
        logger.info('Scanner beep sound loaded successfully');
      } catch (error) {
        logger.error('Failed to load scanner beep sound', error);
      }
    }

    loadSound();

    // Unload sound when component unmounts
    return () => {
      if (sound) {
        logger.info('Unloading scanner beep sound');
        sound.unloadAsync();
      }
    };
  }, []);

  // Play scanner beep sound
  const playBeepSound = async () => {
    try {
      if (sound) {
        // Make sure sound starts from beginning
        await sound.setPositionAsync(0);
        await sound.playAsync();
        logger.info('Scanner beep sound played');
      } else {
        logger.warn('Cannot play scanner beep sound - sound not loaded');
      }
    } catch (error) {
      logger.error('Failed to play scanner beep sound', error);
    }
  };

  // Load settings on mount
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await storageService.getItem('appSettings');
        if (settings) {
          const parsedSettings = JSON.parse(settings);
          setAutoSend(parsedSettings.autoSend ?? true);
        }
      } catch (error) {
        logger.error('Error loading settings', error);
      }
    };

    loadSettings();
  }, []);

  // Send barcode data to USB device
  const sendBarcodeToUSB = useCallback(async (data: string, format: string) => {
    // Prevent duplicate sends
    if (data === lastSentBarcode) {
      logger.info('Skipping duplicate barcode send', { data });
      return;
    }
    
    try {
      if (usbService.isDeviceConnected()) {
        logger.info('Sending barcode to USB device', { data, format });
        await usbService.sendBarcodeData(data, format);
        setLastSentBarcode(data);
      } else {
        logger.warn('USB device not connected, barcode not sent', { data });
        Alert.alert(
          'USB Not Connected',
          'The barcode was saved but could not be sent to the USB device. Please connect the USB device and try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      logger.error('Error sending barcode to USB', { error, data });
      Alert.alert(
        'Transmission Error',
        'Failed to send barcode data to USB device. Please check the connection and try again.',
        [{ text: 'OK' }]
      );
    }
  }, [lastSentBarcode, usbService]);

  // Handle barcode scanning
  const handleBarcodeScanned = useCallback((data: string, format: string = 'CODE_128') => {
    logger.info('Barcode scanned', { data, format });
    
    // Play beep sound when barcode is scanned
    playBeepSound();
    
    // Process the barcode with the BarcodeService
    barcodeService.handleBarcodeScan(data);
    
    // Only set barcode if auto-send is enabled (to trigger TransmissionStatus)
    if (autoSend) {
      setCurrentBarcode(data);
      
      // Send to USB device with proper format
      sendBarcodeToUSB(data, format);
      
      // Reset barcode after a delay to allow for multiple scans
      setTimeout(() => {
        setCurrentBarcode(undefined);
      }, 3000);
    } else {
      // Show an alert if auto-send is disabled
      Alert.alert(
        'Barcode Scanned',
        `Scanned: ${data}\nFormat: ${format}`,
        [{ text: 'OK' }]
      );
    }
  }, [autoSend, barcodeService, sendBarcodeToUSB, playBeepSound]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* USB Connection Status */}
      <USBConnectionStatus
        onConnect={() => logger.info('USB Connected from UI')}
        onDisconnect={() => logger.info('USB Disconnected from UI')}
      />
      
      {/* Barcode Scanner */}
      <View style={styles.scannerContainer}>
        <ExpoCompatibleScanner onBarcodeScanned={handleBarcodeScanned} />
      </View>
      
      {/* Transmission Status Overlay */}
      <TransmissionStatus barcode={currentBarcode} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  scannerContainer: {
    flex: 1,
  },
});

export default ScannerScreen; 