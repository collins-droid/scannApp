import StorageService from './StorageService';
import USBService from './USBService';
import LoggingService from './LoggingService';
import DataProcessingService, { BarcodeFormat } from './DataProcessingService';

/**
 * Interface for barcode data
 */
export interface BarcodeData {
  data: string;
  format: BarcodeFormat;
  timestamp: number;
}

/**
 * Interface for a queued item
 */
export interface QueuedItem {
  id: string;
  data: BarcodeData;
  format: BarcodeFormat;
  timestamp: Date;
  retryCount: number;
  compressed: boolean;
  additionalData?: Record<string, any>;
}

/**
 * Transmission status enum
 */
export enum TransmissionStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Service for managing transmission queue and handling offline operations
 */
export default class TransmissionQueueService {
  private static instance: TransmissionQueueService;
  private queue: QueuedItem[] = [];
  private isProcessing: boolean = false;
  private maxRetries: number = 3;
  private autoRetry: boolean = true;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private storageKey: string = 'transmissionQueue';
  
  private storageService: StorageService;
  private usbService: USBService;
  private logger: LoggingService;
  private dataProcessingService: DataProcessingService;

  /**
   * Initialize the service
   */
  private constructor() {
    this.storageService = StorageService.getInstance();
    this.usbService = USBService.getInstance();
    this.logger = LoggingService.getInstance();
    this.dataProcessingService = DataProcessingService.getInstance();
    
    // Load queue from storage
    this.loadQueue();
    
    // Start processing interval (every 10 seconds)
    this.startProcessingInterval(10000);
  }

  /**
   * Get the singleton instance of TransmissionQueueService
   */
  public static getInstance(): TransmissionQueueService {
    if (!TransmissionQueueService.instance) {
      TransmissionQueueService.instance = new TransmissionQueueService();
    }
    return TransmissionQueueService.instance;
  }

  /**
   * Add an item to the transmission queue
   * @param data Barcode data to queue
   * @param format Barcode format
   * @param compress Whether to compress the data
   * @param additionalData Any additional data to include
   * @returns The queued item
   */
  public async addToQueue(
    data: string,
    format: BarcodeFormat,
    compress: boolean = false,
    additionalData?: Record<string, any>
  ): Promise<QueuedItem> {
    // Validate barcode
    if (!this.dataProcessingService.validateBarcode(data, format)) {
      throw new Error(`Invalid barcode format: ${data} is not a valid ${format}`);
    }
    
    // Create a unique ID
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create barcode data object
    const barcodeData: BarcodeData = {
      data,
      format,
      timestamp: Date.now()
    };
    
    // Format data for transmission
    const formattedData = JSON.stringify({
      ...barcodeData,
      ...additionalData
    });
    
    // Compress if requested
    const finalData = compress ? 
      this.dataProcessingService.compressData(formattedData) : 
      formattedData;
    
    // Create queue item
    const queueItem: QueuedItem = {
      id,
      data: barcodeData,
      format,
      timestamp: new Date(),
      retryCount: 0,
      compressed: compress,
      additionalData,
    };
    
    // Add to queue
    this.queue.push(queueItem);
    
    // Save queue to storage
    await this.saveQueue();
    
    this.logger.info(`Added item to transmission queue: ${id}`);
    
    // Try to process immediately if USB is connected
    if (this.usbService.isDeviceConnected() && !this.isProcessing) {
      this.processQueue();
    }
    
    return queueItem;
  }

  /**
   * Remove an item from the queue
   * @param id The ID of the item to remove
   * @returns True if successful
   */
  public async removeFromQueue(id: string): Promise<boolean> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(item => item.id !== id);
    
    if (this.queue.length !== initialLength) {
      await this.saveQueue();
      this.logger.info(`Removed item from transmission queue: ${id}`);
      return true;
    }
    
    return false;
  }

  /**
   * Clear the entire queue
   */
  public async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    this.logger.info('Transmission queue cleared');
  }

  /**
   * Get the current queue
   * @returns Array of queued items
   */
  public getQueue(): QueuedItem[] {
    return [...this.queue];
  }

  /**
   * Save the queue to storage
   */
  private async saveQueue(): Promise<void> {
    try {
      await this.storageService.storeObject(this.storageKey, this.queue);
    } catch (error) {
      this.logger.error('Failed to save transmission queue', error);
    }
  }

  /**
   * Load the queue from storage
   */
  private async loadQueue(): Promise<void> {
    try {
      const savedQueue = await this.storageService.getObject<QueuedItem[]>(this.storageKey);
      
      if (savedQueue && Array.isArray(savedQueue)) {
        // Convert string timestamps back to Date objects
        this.queue = savedQueue.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
        
        this.logger.info(`Loaded ${this.queue.length} items from transmission queue`);
      }
    } catch (error) {
      this.logger.error('Failed to load transmission queue', error);
    }
  }

  /**
   * Process the queue, sending items to USB device
   */
  public async processQueue(): Promise<void> {
    // Don't process if already processing or queue is empty
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }
    
    // Don't process if no USB device connected
    if (!this.usbService.isDeviceConnected()) {
      this.logger.info('Cannot process queue: No USB device connected');
      return;
    }
    
    this.isProcessing = true;
    this.logger.info(`Processing transmission queue (${this.queue.length} items)`);
    
    try {
      // Process each item in the queue
      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i];
        
        // Skip items that have exceeded retry count
        if (item.retryCount >= this.maxRetries) {
          this.logger.warn(`Skipping item ${item.id}: Max retries exceeded`);
          continue;
        }
        
        try {
          // Format data for transmission
          const formattedData = JSON.stringify({
            ...item.data,
            ...item.additionalData
          });
          
          // Compress if needed
          const finalData = item.compressed ? 
            this.dataProcessingService.compressData(formattedData) : 
            formattedData;
          
          // Attempt to send data
          const success = await this.usbService.sendData(finalData);
          
          if (success) {
            // Remove from queue on success
            this.queue.splice(i, 1);
            i--; // Adjust index for the removed item
            this.logger.info(`Successfully sent queued item: ${item.id}`);
          } else {
            // Increment retry count on failure
            item.retryCount++;
            this.logger.warn(`Failed to send queued item: ${item.id} (retry ${item.retryCount}/${this.maxRetries})`);
          }
        } catch (error) {
          // Increment retry count on error
          item.retryCount++;
          this.logger.error(`Error sending queued item: ${item.id}`, error);
        }
      }
    } finally {
      // Save queue state and reset processing flag
      await this.saveQueue();
      this.isProcessing = false;
    }
  }

  /**
   * Send multiple items in batch
   * @param itemIds Array of item IDs to send
   * @returns True if all items were sent successfully
   */
  public async sendBatch(itemIds: string[]): Promise<boolean> {
    if (!this.usbService.isDeviceConnected()) {
      this.logger.warn('Cannot send batch: No USB device connected');
      return false;
    }
    
    // Find all the requested items
    const items = this.queue.filter(item => itemIds.includes(item.id));
    
    if (items.length === 0) {
      this.logger.warn('No matching items found for batch send');
      return false;
    }
    
    // Create a batch object
    const batchData = {
      type: 'BATCH',
      timestamp: new Date().toISOString(),
      count: items.length,
      items: items.map(item => ({
        id: item.id,
        data: item.data,
        format: item.format,
        compressed: item.compressed,
      })),
    };
    
    // Send the batch
    const batchJson = JSON.stringify(batchData);
    
    try {
      const success = await this.usbService.sendData(batchJson);
      
      if (success) {
        // Remove sent items from queue
        for (const item of items) {
          await this.removeFromQueue(item.id);
        }
        
        this.logger.info(`Successfully sent batch of ${items.length} items`);
        return true;
      } else {
        this.logger.warn('Failed to send batch');
        return false;
      }
    } catch (error) {
      this.logger.error('Error sending batch', error);
      return false;
    }
  }

  /**
   * Start the queue processing interval
   * @param intervalMs Interval in milliseconds
   */
  public startProcessingInterval(intervalMs: number): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    
    this.processingInterval = setInterval(() => {
      if (this.autoRetry && this.queue.length > 0 && this.usbService.isDeviceConnected()) {
        this.processQueue();
      }
    }, intervalMs);
    
    this.logger.info(`Started queue processing interval (${intervalMs}ms)`);
  }

  /**
   * Stop the queue processing interval
   */
  public stopProcessingInterval(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      this.logger.info('Stopped queue processing interval');
    }
  }

  /**
   * Set whether to automatically retry sending
   * @param autoRetry Whether to auto retry
   */
  public setAutoRetry(autoRetry: boolean): void {
    this.autoRetry = autoRetry;
  }

  /**
   * Set the maximum number of retries for a queue item
   * @param maxRetries Maximum number of retries
   */
  public setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }
} 