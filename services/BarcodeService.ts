import { useState, useEffect } from 'react';
import { ScanItem } from '../components/ScanHistory';
import StorageService from './StorageService';
import LoggingService from './LoggingService';
import USBService from './USBService';
import NetworkService from './NetworkService';

/**
 * Service for handling barcode scanning functionality
 */
export default class BarcodeService {
  private static instance: BarcodeService;
  private scanHistory: ScanItem[] = [];
  private logger: LoggingService;
  private storageService: StorageService;
  private usbService: USBService;
  private networkService: NetworkService;
  private readonly storageKey = 'scanHistory';
  private isScanning: boolean = false;

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
    this.usbService = USBService.getInstance();
    this.networkService = NetworkService.getInstance();
    
    // Load scan history from storage
    this.loadScanHistory();
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
   * Start barcode scanning
   * @returns Promise with start result
   */
  public async startScanning(): Promise<boolean> {
    try {
      this.isScanning = true;
      return true;
    } catch (error) {
      this.logger.error('Error starting barcode scanning:', error);
      throw error;
    }
  }

  /**
   * Stop barcode scanning
   * @returns Promise with stop result
   */
  public async stopScanning(): Promise<boolean> {
    try {
      this.isScanning = false;
      return true;
    } catch (error) {
      this.logger.error('Error stopping barcode scanning:', error);
      throw error;
    }
  }

  /**
   * Handle barcode scanning
   * @param data The barcode data scanned
   * @returns The processed barcode data
   */
  public async handleBarcodeScan(data: string): Promise<string> {
    if (!this.isScanning) {
      return data;
    }

    this.logger.info('Barcode scanned:', data);
    
    try {
      // Add to scan history
      this.addToScanHistory(data);
      
      // Send data to configured destinations
      await this.sendBarcodeData(data);
      
      return data;
    } catch (error) {
      this.logger.error('Error handling barcode scan:', error);
      throw error;
    }
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
   * Send barcode data to configured destinations
   * @param data Barcode data to send
   */
  private async sendBarcodeData(data: string): Promise<void> {
    try {
      // Send via USB
      await this.usbService.sendData(data);
      
      // Send via network
      await this.networkService.sendData(data);
      
      // Update scan history to mark as sent
      const lastItem = this.scanHistory[this.scanHistory.length - 1];
      if (lastItem) {
        lastItem.sent = true;
        this.saveScanHistory();
      }
    } catch (error) {
      this.logger.error('Error sending barcode data:', error);
      throw error;
    }
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
    
    // Update scan history when it changes
    const updateHistory = () => {
      setScanHistory(barcodeService.getScanHistory());
    };
    
    // Listen for storage changes
    window.addEventListener('storage', updateHistory);
    
    return () => {
      window.removeEventListener('storage', updateHistory);
    };
  }, []);

  return {
    scanHistory,
    handleBarcodeScan: barcodeService.handleBarcodeScan.bind(barcodeService),
    clearScanHistory: barcodeService.clearScanHistory.bind(barcodeService),
    startScanning: barcodeService.startScanning.bind(barcodeService),
    stopScanning: barcodeService.stopScanning.bind(barcodeService),
  };
}; 