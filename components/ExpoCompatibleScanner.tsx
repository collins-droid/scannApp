import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
}

/**
 * Barcode scanner component using Expo Camera
 */
export default function ExpoCompatibleScanner({ onBarcodeScanned }: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState(false);
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const logger = LoggingService.getInstance();

  // Request camera permissions if needed
  useEffect(() => {
    if (permission && !permission.granted) {
      requestPermission();
    }
    
    if (permission?.granted) {
      logger.info('Camera permission granted');
    }
  }, [permission, requestPermission]);

  // Handle successful scan animation
  useEffect(() => {
    if (scanSuccess) {
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [scanSuccess]);

  // Handle barcode detection
  const handleBarCodeScanned = (barcode: { data: string; type: string }) => {
    const { data, type } = barcode;
    
    if (!isScanning || data === lastScanned) return;
    
    // Prevent duplicate scans
    setIsScanning(false);
    setLastScanned(data);
    setScanSuccess(true);
    
    logger.info('Barcode detected:', { data, type });
    
    // Call the callback with the scanned barcode data
    onBarcodeScanned(data);
    
    // Resume scanning after a delay
    setTimeout(() => {
      setIsScanning(true);
      setScanSuccess(false);
    }, 3000);
  };
  
  // If permission is still being checked
  if (!permission) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Initializing camera...</Text>
      </View>
    );
  }

  // If permission was denied
  if (!permission.granted) {
    return (
      <View style={styles.permissionDeniedContainer}>
        <Text style={styles.permissionDeniedText}>Camera permission denied</Text>
        <Text style={styles.permissionDeniedSubtext}>
          Please grant camera permission to scan barcodes.
        </Text>
        <TouchableOpacity 
          style={styles.permissionButton} 
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr", "ean13", "ean8", "code128", "code39", "upc_e"],
        }}
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
      >
        <Animated.View 
          style={[
            styles.overlay,
            scanSuccess && {
              backgroundColor: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(0,0,0,0)', 'rgba(76, 175, 80, 0.3)']
              })
            }
          ]}
        >
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {isScanning 
                ? 'Position barcode anywhere on screen' 
                : 'Barcode detected! Sending to server...'}
            </Text>
            {!isScanning && (
              <ActivityIndicator 
                size="small" 
                color="#4CAF50" 
                style={styles.statusIndicator} 
              />
            )}
          </View>
        </Animated.View>
      </CameraView>
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
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
    borderRadius: 25,
    marginHorizontal: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginRight: 10,
  },
  statusIndicator: {
    marginLeft: 5,
  },
}); 