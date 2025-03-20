import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import LoggingService from '../services/LoggingService';

interface BarcodeScannerProps {
  onBarcodeScanned: (data: string) => void;
}

/**
 * A mock barcode scanner that generates fake barcodes when pressed
 * Used to simulate scanning without camera access
 */
export default function MockBarcodeScanner({ onBarcodeScanned }: BarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const logger = LoggingService.getInstance();

  // Generate a random barcode when pressed
  const simulateScan = () => {
    if (isScanning) return;
    
    setIsScanning(true);
    
    // Generate a random barcode format
    const prefix = ['978', '977', '979', '12', '50'].at(Math.floor(Math.random() * 5)) || '';
    const middle = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    const mockBarcode = `${prefix}${middle}`.substring(0, 13);
    
    logger.info('Simulated barcode scan:', mockBarcode);
    onBarcodeScanned(mockBarcode);
    
    // Reset scanning after a delay
    setTimeout(() => {
      setIsScanning(false);
    }, 3000);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mockCamera}>
        <TouchableOpacity 
          style={[styles.scanButton, isScanning ? styles.scanningButton : {}]} 
          onPress={simulateScan}
          disabled={isScanning}
        >
          <Text style={styles.scanButtonText}>
            {isScanning ? "SCANNING..." : "TAP TO SCAN"}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.overlay}>
        <Text style={styles.infoText}>
          {isScanning 
            ? "Barcode detected!" 
            : "This is a mock scanner.\nTap the button to simulate scanning a barcode."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mockCamera: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#2196F3',
    padding: 20,
    borderRadius: 10,
    width: 200,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  scanningButton: {
    backgroundColor: '#4CAF50',
  },
  scanButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  overlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  infoText: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 20,
    fontSize: 16,
    textAlign: 'center',
  },
}); 