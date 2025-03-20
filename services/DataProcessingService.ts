import LoggingService from './LoggingService';
import * as pako from 'pako';
import { Buffer } from 'buffer';

/**
 * Enumeration of supported barcode formats
 */
export enum BarcodeFormat {
  CODE128 = 'CODE128',
  CODE39 = 'CODE39',
  EAN13 = 'EAN13',
  EAN8 = 'EAN8',
  UPC_E = 'UPC_E',
  QR = 'QR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Data format options for transmission
 */
export enum DataFormat {
  JSON = 'json',
  CSV = 'csv',
  XML = 'xml',
  TEXT = 'text',
  BINARY = 'binary'
}

/**
 * Compression options
 */
export enum CompressionType {
  NONE = 'none',
  GZIP = 'gzip',
  DEFLATE = 'deflate'
}

/**
 * Interface for barcode data
 */
export interface BarcodeData {
  content: string;
  format: BarcodeFormat;
  timestamp: string;
  additionalData?: Record<string, any>;
}

/**
 * Batch data interface
 */
export interface BatchData {
  batchId: string;
  items: BarcodeData[];
  timestamp: string;
  deviceId?: string;
  sessionId?: string;
  format: DataFormat;
  compressed: boolean;
  compressionType?: CompressionType;
  additionalData?: Record<string, any>;
}

/**
 * Data processing service for barcode validation and processing
 */
export default class DataProcessingService {
  private static instance: DataProcessingService;
  private logger: LoggingService;
  
  /**
   * Get singleton instance
   */
  public static getInstance(): DataProcessingService {
    if (!DataProcessingService.instance) {
      DataProcessingService.instance = new DataProcessingService();
    }
    return DataProcessingService.instance;
  }
  
  /**
   * Initialize service
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
  }
  
  /**
   * Validate a barcode based on its format
   * @param barcode Barcode string
   * @param format Barcode format
   * @returns Whether the barcode is valid
   */
  public validateBarcode(barcode: string, format: BarcodeFormat): boolean {
    if (!barcode || !barcode.trim()) {
      return false;
    }
    
    try {
      switch (format) {
        case BarcodeFormat.CODE128:
          // CODE128 can encode all 128 ASCII characters
          // Just check for valid length and visible ASCII
          return barcode.length > 1 && 
                 barcode.length <= 80 && 
                 /^[\x20-\x7E]+$/.test(barcode);
            
        case BarcodeFormat.CODE39:
          // CODE39 uses only uppercase letters, numbers and some special chars
          return /^[A-Z0-9\-\.\ \$\/\+\%]+$/.test(barcode);
            
        case BarcodeFormat.EAN13:
          // EAN-13 is 13 digits, check for valid checksum
          if (!/^\d{13}$/.test(barcode)) {
            return false;
          }
          return this.validateCheckDigit(barcode);
            
        case BarcodeFormat.EAN8:
          // EAN-8 is 8 digits, check for valid checksum
          if (!/^\d{8}$/.test(barcode)) {
            return false;
          }
          return this.validateCheckDigit(barcode);
            
        case BarcodeFormat.UPC_E:
          // UPC-E is 8 digits (with check digit), validate pattern
          if (!/^\d{8}$/.test(barcode)) {
            return false;
          }
          return this.validateCheckDigit(barcode);
            
        case BarcodeFormat.QR:
          // QR codes can store lots of data, just do a basic length check
          return barcode.length > 0 && barcode.length <= 4296;
            
        default:
          // For unknown formats, just ensure it's not empty
          return barcode.length > 0;
      }
    } catch (error) {
      this.logger.error(`Error validating barcode: ${error}`);
      return false;
    }
  }
  
  /**
   * Validate check digit for EAN/UPC barcodes
   * @param barcode Barcode with check digit
   * @returns Whether check digit is valid
   */
  private validateCheckDigit(barcode: string): boolean {
    if (!/^\d+$/.test(barcode)) {
      return false;
    }
    
    const digits = barcode.split('').map(Number);
    const checkDigit = digits.pop() as number;
    
    let sum = 0;
    let multiplier = 3; // Start with 3 for rightmost digit (excluding check digit)
    
    // Process from right to left (excluding check digit)
    for (let i = digits.length - 1; i >= 0; i--) {
      sum += digits[i] * multiplier;
      multiplier = multiplier === 3 ? 1 : 3; // Alternate between 3 and 1
    }
    
    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheckDigit;
  }
  
  /**
   * Detect barcode format based on content
   * @param barcode Barcode string
   * @returns Detected format
   */
  public detectBarcodeFormat(barcode: string): BarcodeFormat {
    if (!barcode || !barcode.trim()) {
      return BarcodeFormat.UNKNOWN;
    }
    
    // EAN-13
    if (/^\d{13}$/.test(barcode) && this.validateCheckDigit(barcode)) {
      return BarcodeFormat.EAN13;
    }
    
    // EAN-8
    if (/^\d{8}$/.test(barcode) && this.validateCheckDigit(barcode)) {
      return BarcodeFormat.EAN8;
    }
    
    // UPC-E
    if (/^\d{8}$/.test(barcode) && this.validateCheckDigit(barcode)) {
      return BarcodeFormat.UPC_E;
    }
    
    // CODE39
    if (/^[A-Z0-9\-\.\ \$\/\+\%]+$/.test(barcode)) {
      return BarcodeFormat.CODE39;
    }
    
    // Fallback to CODE128 as it supports all ASCII
    if (/^[\x20-\x7E]+$/.test(barcode)) {
      return BarcodeFormat.CODE128;
    }
    
    // If it contains non-printable characters or is very long, it might be QR
    if (barcode.length > 20) {
      return BarcodeFormat.QR;
    }
    
    return BarcodeFormat.UNKNOWN;
  }
  
  /**
   * Format barcode data for transmission
   * @param barcode Barcode string
   * @param format Barcode format
   * @param additionalData Additional metadata
   * @returns Formatted barcode data
   */
  public formatForTransmission(
    barcode: string, 
    format: BarcodeFormat = BarcodeFormat.UNKNOWN,
    additionalData?: Record<string, any>
  ): BarcodeData {
    // Auto-detect format if not provided
    if (format === BarcodeFormat.UNKNOWN) {
      format = this.detectBarcodeFormat(barcode);
    }
    
    return {
      content: barcode,
      format,
      timestamp: new Date().toISOString(),
      additionalData
    };
  }
  
  /**
   * Create batch data for transmission
   * @param barcodes Array of barcode data
   * @param options Batch options
   * @returns Formatted batch data
   */
  public createBatch(
    barcodes: BarcodeData[], 
    options: {
      batchId?: string;
      deviceId?: string;
      sessionId?: string;
      format?: DataFormat;
      compress?: boolean;
      compressionType?: CompressionType;
      additionalData?: Record<string, any>;
    } = {}
  ): BatchData {
    const batchId = options.batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const format = options.format || DataFormat.JSON;
    const compressed = options.compress || false;
    const compressionType = options.compressionType || CompressionType.GZIP;
    
    return {
      batchId,
      items: barcodes,
      timestamp: new Date().toISOString(),
      deviceId: options.deviceId,
      sessionId: options.sessionId,
      format,
      compressed,
      compressionType: compressed ? compressionType : undefined,
      additionalData: options.additionalData
    };
  }
  
  /**
   * Serialize batch data based on format
   * @param batch Batch data
   * @returns Serialized data
   */
  public serializeBatch(batch: BatchData): string {
    switch (batch.format) {
      case DataFormat.JSON:
        return JSON.stringify(batch);
        
      case DataFormat.CSV:
        // Basic CSV implementation
        let csv = 'content,format,timestamp\n';
        batch.items.forEach(item => {
          csv += `${item.content},${item.format},${item.timestamp}\n`;
        });
        return csv;
        
      case DataFormat.XML:
        // Basic XML implementation
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<batch id="${batch.batchId}" timestamp="${batch.timestamp}">\n`;
        batch.items.forEach(item => {
          xml += `  <barcode format="${item.format}" timestamp="${item.timestamp}">${item.content}</barcode>\n`;
        });
        xml += '</batch>';
        return xml;
        
      case DataFormat.TEXT:
        // Simple text format
        let text = `Batch: ${batch.batchId}\nTimestamp: ${batch.timestamp}\n\nItems:\n`;
        batch.items.forEach(item => {
          text += `${item.format}: ${item.content} (${item.timestamp})\n`;
        });
        return text;
        
      default:
        return JSON.stringify(batch);
    }
  }
  
  /**
   * Compress data using specified method
   * @param data Data to compress
   * @param type Compression type
   * @returns Compressed data as base64 string
   */
  public compressData(data: string, type: CompressionType = CompressionType.GZIP): string {
    try {
      if (type === CompressionType.NONE) {
        return data;
      }
      
      const inputBuffer = Buffer.from(data, 'utf8');
      let compressedData: Uint8Array;
      
      if (type === CompressionType.GZIP) {
        compressedData = pako.gzip(inputBuffer);
      } else {
        compressedData = pako.deflate(inputBuffer);
      }
      
      return Buffer.from(compressedData).toString('base64');
    } catch (error) {
      this.logger.error(`Compression error: ${error}`);
      return data; // Return original data if compression fails
    }
  }
  
  /**
   * Decompress data
   * @param data Compressed data as base64 string
   * @param type Compression type
   * @returns Decompressed data string
   */
  public decompressData(data: string, type: CompressionType = CompressionType.GZIP): string {
    try {
      if (type === CompressionType.NONE) {
        return data;
      }
      
      const compressedBuffer = Buffer.from(data, 'base64');
      let decompressedData: Uint8Array;
      
      if (type === CompressionType.GZIP) {
        decompressedData = pako.ungzip(compressedBuffer);
      } else {
        decompressedData = pako.inflate(compressedBuffer);
      }
      
      return Buffer.from(decompressedData).toString('utf8');
    } catch (error) {
      this.logger.error(`Decompression error: ${error}`);
      return data; // Return original data if decompression fails
    }
  }
  
  /**
   * Process and prepare batch for transmission
   * @param barcodes Array of barcode data
   * @param options Batch options
   * @returns Prepared data for transmission
   */
  public prepareBatchForTransmission(
    barcodes: BarcodeData[],
    options: {
      batchId?: string;
      deviceId?: string;
      sessionId?: string;
      format?: DataFormat;
      compress?: boolean;
      compressionType?: CompressionType;
      additionalData?: Record<string, any>;
    } = {}
  ): { data: string; batch: BatchData } {
    // Create batch
    const batch = this.createBatch(barcodes, options);
    
    // Serialize based on format
    let serializedData = this.serializeBatch(batch);
    
    // Compress if needed
    if (batch.compressed && batch.compressionType) {
      serializedData = this.compressData(serializedData, batch.compressionType);
    }
    
    return {
      data: serializedData,
      batch
    };
  }
} 