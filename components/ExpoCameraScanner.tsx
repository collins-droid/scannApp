import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
}

/**
 * Barcode scanner component using the new Expo Camera API - compatible with Expo Go
 */
export default function ExpoCameraScanner({ onBarcodeScanned }: BarcodeScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const logger = LoggingService.getInstance();

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      logger.info('Camera permission status:', status);
    };

    getCameraPermissions();
  }, []);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    logger.info('Barcode detected:', { data, type });
    onBarcodeScanned(data);
    
    // Reset scan state after a delay
    setTimeout(() => {
      setScanned(false);
    }, 3000);
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text>No access to camera</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "pdf417"],
        }}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanRegion} />
        <Text style={styles.statusText}>
          {scanned ? 'Barcode detected!' : 'Position barcode in the scanning area'}
        </Text>
        
        {scanned && (
          <Button title="Tap to Scan Again" onPress={() => setScanned(false)} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanRegion: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#2196F3',
    backgroundColor: 'transparent',
    borderRadius: 10,
  },
  statusText: {
    position: 'absolute',
    bottom: 50,
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 20,
    fontSize: 16,
    textAlign: 'center',
  },
}); 