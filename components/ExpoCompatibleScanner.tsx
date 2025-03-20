import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string, format?: string) => void;
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

  // Get screen dimensions
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  // Make scan area wider and taller - more like a store scanner
  const scanAreaWidth = screenWidth * 0.85;
  const scanAreaHeight = screenHeight * 0.7; // Increased height for better scanning area

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
    
    // Only prevent scanning if we're currently in a scan-disabled state
    // This allows the same barcode to be scanned again after the timeout
    if (!isScanning) return;
    
    // Prevent rapid scanning by setting isScanning to false temporarily
    setIsScanning(false);
    setLastScanned(data);
    setScanSuccess(true);
    
    logger.info('Barcode detected:', { data, type });
    
    // Call the callback with the scanned barcode data and format
    onBarcodeScanned(data, mapBarcodeType(type));
    
    // Resume scanning after a delay
    // This will allow ANY barcode to be scanned after this timeout
    // including the same item multiple times (like a store cashier)
    setTimeout(() => {
      setIsScanning(true);
      setScanSuccess(false);
      // Don't reset lastScanned here - this allows reporting that the same
      // barcode was scanned again, rather than filtering it out
    }, 2000); // Reduced to 2 seconds to allow faster repeated scanning
  };
  
  // Map barcode types to formats expected by the laptop receiver
  const mapBarcodeType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
      'org.iso.QRCode': 'QR_CODE',
      'org.iso.Code128': 'CODE_128',
      'org.iso.Code39': 'CODE_39',
      'org.gs1.EAN-13': 'EAN_13',
      'org.gs1.EAN-8': 'EAN_8',
      'org.gs1.UPC-E': 'UPC_E',
      'org.gs1.UPC-A': 'UPC_A',
      'org.gs1.DataMatrix': 'DATA_MATRIX',
      'org.ansi.Interleaved2of5': 'ITF',
      'org.gs1.GS1DataBar': 'PDF_417'
    };
    
    return typeMap[type] || 'UNKNOWN';
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
          {/* Scanning Area Guide */}
          <View style={[styles.scanArea, { width: scanAreaWidth, height: scanAreaHeight }]}>
            <View style={styles.scanAreaBorder}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.scanAreaText}>SCAN PRODUCT HERE</Text>
            <Text style={styles.scanAreaSubtext}>Scan same item multiple times to increase quantity</Text>
          </View>

          {/* Status Container */}
          <View style={styles.statusContainer}>
            <Text style={styles.statusText}>
              {isScanning 
                ? 'Ready to scan' 
                : 'Barcode detected! Processing...'}
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
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanArea: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scanAreaBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#4CAF50',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTopRight: {
    top: -3,
    right: -3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBottomLeft: {
    bottom: -3,
    left: -3,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBottomRight: {
    bottom: -3,
    right: -3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanAreaText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanAreaSubtext: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 50,
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