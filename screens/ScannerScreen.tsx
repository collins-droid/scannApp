import React, { useState, useCallback } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, StatusBar } from 'react-native';
import BarcodeScanner from '../components/BarcodeScanner';
import USBConnectionStatus from '../components/USBConnectionStatus';
import TransmissionStatus from '../components/TransmissionStatus';
import LoggingService from '../services/LoggingService';
import StorageService from '../services/StorageService';
import { AppSettings } from '../components/SettingsForm';

/**
 * Main scanner screen that shows the camera for barcode scanning
 */
const ScannerScreen: React.FC = () => {
  const [currentBarcode, setCurrentBarcode] = useState<string | undefined>(undefined);
  const [autoSend, setAutoSend] = useState<boolean>(true);
  const logger = LoggingService.getInstance();
  const storageService = StorageService.getInstance();

  // Load settings on mount
  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await storageService.getObject<AppSettings>('appSettings');
        if (settings) {
          setAutoSend(settings.autoSend);
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
    
    // Only set barcode if auto-send is enabled (to trigger TransmissionStatus)
    if (autoSend) {
      setCurrentBarcode(data);
      
      // Reset barcode after a delay to allow for multiple scans
      setTimeout(() => {
        setCurrentBarcode(undefined);
      }, 3000);
    }
  }, [autoSend]);

  // Handle scanning errors
  const handleScanError = useCallback((error: Error) => {
    logger.error('Barcode scanning error', error);
  }, []);

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
        <BarcodeScanner
          onBarcodeScanned={handleBarcodeScanned}
          onError={handleScanError}
        />
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