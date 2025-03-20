import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar, Alert } from 'react-native';
import ExpoCompatibleScanner from '../components/ExpoCompatibleScanner';
import USBConnectionStatus from '../components/USBConnectionStatus';
import TransmissionStatus from '../components/TransmissionStatus';
import LoggingService from '../services/LoggingService';
import BarcodeService from '../services/BarcodeService';
import StorageService from '../services/StorageService';
import { AppSettings } from '../components/SettingsForm';

/**
 * Main scanner screen that shows the camera for barcode scanning
 */
const ScannerScreen: React.FC = () => {
  const [currentBarcode, setCurrentBarcode] = useState<string | undefined>(undefined);
  const [autoSend, setAutoSend] = useState<boolean>(true);
  const logger = LoggingService.getInstance();
  const barcodeService = BarcodeService.getInstance();
  const storageService = StorageService.getInstance();

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

  // Handle barcode scanning
  const handleBarcodeScanned = useCallback((data: string) => {
    logger.info('Barcode scanned', { data });
    
    // Process the barcode with the BarcodeService
    barcodeService.handleBarcodeScan(data);
    
    // Only set barcode if auto-send is enabled (to trigger TransmissionStatus)
    if (autoSend) {
      setCurrentBarcode(data);
      
      // Reset barcode after a delay to allow for multiple scans
      setTimeout(() => {
        setCurrentBarcode(undefined);
      }, 3000);
    } else {
      // Show an alert if auto-send is disabled
      Alert.alert(
        'Barcode Scanned',
        `Scanned: ${data}`,
        [{ text: 'OK' }]
      );
    }
  }, [autoSend, barcodeService]);

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