import { Camera } from 'expo-camera';
import { useState, useEffect } from 'react';

/**
 * Service for handling barcode scanning functionality
 */
export default class BarcodeService {
  private static instance: BarcodeService;
  private scanHistory: string[] = [];

  /**
   * Get the singleton instance of BarcodeService
   */
  public static getInstance(): BarcodeService {
    if (!BarcodeService.instance) {
      BarcodeService.instance = new BarcodeService();
    }
    return BarcodeService.instance;
  }

  /**
   * Request camera permissions
   * @returns Promise with permission status
   */
  public async requestCameraPermission(): Promise<boolean> {
    const { status } = await Camera.requestCameraPermissionsAsync();
    return status === 'granted';
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
    this.scanHistory.push(barcodeData);
    
    // TODO: Implement AsyncStorage persistence in future implementation
  }

  /**
   * Get the scan history
   * @returns Array of scanned barcodes
   */
  public getScanHistory(): string[] {
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