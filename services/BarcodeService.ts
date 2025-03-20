import { useState, useEffect } from 'react';
import { ScanItem } from '../components/ScanHistory';
import { Platform } from 'react-native';

/**
 * Service for handling barcode scanning functionality
 */
export default class BarcodeService {
  private static instance: BarcodeService;
  private scanHistory: ScanItem[] = [];

  /**
   * Get the singleton instance of BarcodeService
   */
  public static getInstance(): BarcodeService {
    if (!BarcodeService.instance) {
      BarcodeService.instance = new BarcodeService();
      // Add some sample data
      BarcodeService.instance.addSampleData();
    }
    return BarcodeService.instance;
  }

  /**
   * Add sample data for demonstration
   */
  private addSampleData(): void {
    // Only add sample data if the history is empty
    if (this.scanHistory.length === 0) {
      const sampleBarcodes = [
        '9780201896831', // EAN-13
        '12345678', // EAN-8
        'CODE39TEST', // CODE39
        'PRODUCT1234', // CODE128
      ];
      
      // Add sample barcodes with different timestamps
      sampleBarcodes.forEach((barcode, index) => {
        const timestamp = new Date();
        timestamp.setMinutes(timestamp.getMinutes() - index * 10); // Space out the timestamps
        
        this.scanHistory.push({
          id: `sample-${index}-${Date.now()}`,
          data: barcode,
          timestamp,
          sent: index < 2, // Mark some as sent for demonstration
        });
      });
      
      console.log('Sample scan history data added');
    }
  }

  /**
   * Request camera permissions - mock implementation
   * @returns Promise with permission status
   */
  public async requestCameraPermission(): Promise<boolean> {
    // We're using a mock scanner that doesn't need camera permission
    // In a real app, we would request camera permissions here
    console.log('Mock camera permission requested - auto-granting for development');
    return true;
  }

  /**
   * Handle barcode scanning
   * @param data The barcode data scanned
   * @returns The processed barcode data
   */
  public handleBarcodeScan(data: string): string {
    console.log('Barcode scanned:', data);
    
    // Add to scan history
    this.addToScanHistory(data);
    
    return data;
  }

  /**
   * Add scanned barcode to history
   * @param barcodeData The barcode data to add to history
   */
  private addToScanHistory(barcodeData: string): void {
    const scanItem: ScanItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      data: barcodeData,
      timestamp: new Date(),
      sent: false
    };
    
    this.scanHistory.push(scanItem);
    
    // TODO: Implement AsyncStorage persistence in future implementation
  }

  /**
   * Get the scan history
   * @returns Array of scanned items
   */
  public getScanHistory(): ScanItem[] {
    return [...this.scanHistory];
  }

  /**
   * Clear the scan history
   */
  public clearScanHistory(): void {
    this.scanHistory = [];
    
    // TODO: Clear AsyncStorage in future implementation
  }
}

/**
 * React hook for using the barcode service
 */
export const useBarcodeScanner = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const barcodeService = BarcodeService.getInstance();

  useEffect(() => {
    (async () => {
      const permissionGranted = await barcodeService.requestCameraPermission();
      setHasPermission(permissionGranted);
    })();
  }, []);

  return {
    hasPermission,
    handleBarcodeScan: barcodeService.handleBarcodeScan.bind(barcodeService),
    getScanHistory: barcodeService.getScanHistory.bind(barcodeService),
    clearScanHistory: barcodeService.clearScanHistory.bind(barcodeService),
  };
}; 