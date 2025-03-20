import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useScanBarcodes, BarcodeFormat } from 'vision-camera-code-scanner';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
}

/**
 * Real barcode scanner component using Vision Camera
 */
export default function VisionBarcodeScanner({ onBarcodeScanned }: BarcodeScannerProps) {
  const [isActive, setIsActive] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);
  const logger = LoggingService.getInstance();

  // Use the proper permission hook
  const { hasPermission, requestPermission } = useCameraPermission();

  // Request camera permissions
  useEffect(() => {
    const getPermission = async () => {
      if (hasPermission === false) {
        await requestPermission();
      }
      
      if (hasPermission) {
        logger.info('Camera permission granted');
      } else {
        logger.warn('Camera permission denied or restricted');
      }
    };

    getPermission();
  }, [hasPermission, requestPermission]);

  // Set up barcode scanning frame processor
  const [frameProcessor, barcodes] = useScanBarcodes([
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.UPC_E,
    BarcodeFormat.UPC_A,
    BarcodeFormat.CODABAR,
  ]);

  // Handle barcode detection
  useEffect(() => {
    if (barcodes && barcodes.length > 0 && isActive) {
      for (const barcode of barcodes) {
        if (barcode.rawValue && barcode.rawValue !== lastScanned) {
          // Prevent duplicate scans of the same barcode
          setLastScanned(barcode.rawValue);
          logger.info('Barcode detected:', { data: barcode.rawValue, type: barcode.format });
          
          // Call the callback with the scanned barcode data
          onBarcodeScanned(barcode.rawValue);
          
          // Pause scanning for a moment to prevent duplicate scans
          setIsActive(false);
          setTimeout(() => {
            setIsActive(true);
          }, 3000);
          
          break;
        }
      }
    }
  }, [barcodes, isActive, lastScanned, onBarcodeScanned]);

  // Get camera device using the proper hook
  const device = useCameraDevice('back');

  // If permission is still being checked
  if (hasPermission === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  // If permission was denied
  if (hasPermission === false) {
    return (
      <View style={styles.permissionDeniedContainer}>
        <Text style={styles.permissionDeniedText}>Camera permission denied</Text>
        <Text style={styles.permissionDeniedSubtext}>
          Please grant camera permission in your device settings to scan barcodes.
        </Text>
      </View>
    );
  }

  // If camera is not available yet
  if (!device) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor as any}
      />
      
      <View style={styles.overlay}>
        <View style={styles.scanRegion} />
        <Text style={styles.statusText}>
          {isActive ? 'Position barcode in the scanning area' : 'Barcode detected!'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
    fontSize: 16,
  },
  permissionDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: 20,
  },
  permissionDeniedText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  permissionDeniedSubtext: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
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