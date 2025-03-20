import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Camera } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { FontAwesome } from '@expo/vector-icons';
import BarcodeService from '../services/BarcodeService';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Component for scanning barcodes using the device camera
 */
const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onBarcodeScanned,
  onError,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [currentBarcode, setCurrentBarcode] = useState<string | null>(null);
  const cameraRef = useRef<Camera>(null);
  const barcodeService = BarcodeService.getInstance();
  const logger = LoggingService.getInstance();

  // Request camera permission on mount
  useEffect(() => {
    (async () => {
      try {
        const permissionGranted = await barcodeService.requestCameraPermission();
        setHasPermission(permissionGranted);
        
        if (!permissionGranted) {
          logger.warn('Camera permission not granted');
          onError && onError(new Error('Camera permission not granted'));
        }
      } catch (error) {
        logger.error('Error requesting camera permission', error);
        setHasPermission(false);
        onError && onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    })();
  }, []);

  // Reset the currentBarcode after a delay
  useEffect(() => {
    if (currentBarcode) {
      const timeout = setTimeout(() => {
        setCurrentBarcode(null);
        setIsScanning(true);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [currentBarcode]);

  // Handle barcode scanning
  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!isScanning || currentBarcode === data) {
      return;
    }
    
    setIsScanning(false);
    setCurrentBarcode(data);
    
    try {
      // Process the barcode data
      const processedData = barcodeService.handleBarcodeScan(data);
      logger.info(`Barcode scanned: ${type}`, { data: processedData });
      
      // Send data to parent component
      onBarcodeScanned(processedData);
    } catch (error) {
      logger.error('Error processing barcode', error);
      onError && onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  // Toggle flash mode
  const toggleFlash = () => {
    setFlashMode(prev => {
      switch (prev) {
        case 'off':
          return 'on';
        case 'on':
          return 'auto';
        default:
          return 'off';
      }
    });
  };

  // Show message when waiting for permission
  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  // Show message when permission is denied
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera access denied</Text>
        <Text style={styles.permissionSubText}>
          Please enable camera access in your device settings to scan barcodes.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Camera
        ref={cameraRef}
        style={styles.camera}
        type={Camera.Constants.Type.back}
        flashMode={flashMode}
        barCodeScannerSettings={{
          barCodeTypes: [
            BarCodeScanner.Constants.BarCodeType.qr,
            BarCodeScanner.Constants.BarCodeType.code128,
            BarCodeScanner.Constants.BarCodeType.code39,
            BarCodeScanner.Constants.BarCodeType.ean13,
            BarCodeScanner.Constants.BarCodeType.ean8,
            BarCodeScanner.Constants.BarCodeType.upc_e,
          ],
        }}
        onBarCodeScanned={isScanning ? handleBarCodeScanned : undefined}
      >
        <View style={styles.scannerOverlay}>
          {/* Targeting frame */}
          <View style={styles.targetingFrame} />
          
          {/* Status text */}
          <View style={styles.statusContainer}>
            {currentBarcode ? (
              <Text style={styles.barcodeText}>{currentBarcode}</Text>
            ) : (
              <Text style={styles.scanText}>Scanning for barcodes...</Text>
            )}
          </View>
          
          {/* Controls */}
          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
              <FontAwesome
                name={flashMode === 'off' ? 'flash' : flashMode === 'on' ? 'flash' : 'bolt'}
                size={24}
                color="white"
              />
              <Text style={styles.controlText}>
                Flash: {flashMode.charAt(0).toUpperCase() + flashMode.slice(1)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Camera>
    </View>
  );
};

const { width } = Dimensions.get('window');
const targetWidth = width * 0.7;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  targetingFrame: {
    width: targetWidth,
    height: targetWidth,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 10,
    alignSelf: 'center',
    marginTop: '20%',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 15,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  barcodeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.8)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    maxWidth: '90%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(64, 64, 64, 0.7)',
    borderRadius: 25,
  },
  controlText: {
    color: 'white',
    marginLeft: 8,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  permissionText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

export default BarcodeScanner; 