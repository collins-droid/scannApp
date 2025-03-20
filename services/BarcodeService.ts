import { useState, useEffect } from 'react';
import { ScanItem } from '../components/ScanHistory';
import StorageService from './StorageService';
import LoggingService from './LoggingService';

/**
 * Service for handling barcode scanning functionality
 */
export default class BarcodeService {
  private static instance: BarcodeService;
  private scanHistory: ScanItem[] = [];
  private logger: LoggingService;
  private storageService: StorageService;
  private readonly storageKey = 'scanHistory';

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
   * Initialize the barcode service
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
    this.storageService = StorageService.getInstance();
    
    // Load scan history from storage
    this.loadScanHistory();
    
    // Add sample data if history is empty
    if (this.scanHistory.length === 0) {
      this.addSampleData();
    }
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
      
      this.logger.info('Sample scan history data added');
      
      // Save to storage
      this.saveScanHistory();
    }
  }

  /**
   * Load scan history from storage
   */
  private async loadScanHistory(): Promise<void> {
    try {
      const storedHistory = await this.storageService.getObject<ScanItem[]>(this.storageKey);
      
      if (storedHistory && storedHistory.length > 0) {
        // Convert stored date strings back to Date objects
        this.scanHistory = storedHistory.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        
        this.logger.info(`Loaded ${this.scanHistory.length} items from scan history storage`);
      }
    } catch (error) {
      this.logger.error('Error loading scan history from storage', error);
    }
  }

  /**
   * Save scan history to storage
   */
  private async saveScanHistory(): Promise<void> {
    try {
      await this.storageService.storeObject(this.storageKey, this.scanHistory);
      this.logger.info(`Saved ${this.scanHistory.length} items to scan history storage`);
    } catch (error) {
      this.logger.error('Error saving scan history to storage', error);
    }
  }

  /**
   * Handle barcode scanning
   * @param data The barcode data scanned
   * @returns The processed barcode data
   */
  public handleBarcodeScan(data: string): string {
    this.logger.info('Barcode scanned:', data);
    
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
    
    // Save to storage
    this.saveScanHistory();
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
    
    // Clear from storage
    this.storageService.removeItem(this.storageKey);
    this.logger.info('Scan history cleared');
  }
}

/**
 * React hook for using the barcode service
 */
export const useBarcodeScanner = () => {
  const [scanHistory, setScanHistory] = useState<ScanItem[]>([]);
  const barcodeService = BarcodeService.getInstance();

  useEffect(() => {
    // Get initial scan history
    setScanHistory(barcodeService.getScanHistory());
    
    // Update scan history every 2 seconds (for demo purposes)
    const intervalId = setInterval(() => {
      setScanHistory(barcodeService.getScanHistory());
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, []);

  return {
    scanHistory,
    handleBarcodeScan: barcodeService.handleBarcodeScan.bind(barcodeService),
    clearScanHistory: barcodeService.clearScanHistory.bind(barcodeService),
  };
}; 