import { Platform } from 'react-native';
import LoggingService from './LoggingService';

interface NetworkConfig {
  host: string;
  port: number;
  protocol: 'http' | 'https';
}

class NetworkService {
  private static instance: NetworkService;
  private logger: LoggingService;
  private config: NetworkConfig;
  private isConnected: boolean = false;
  private serverUrl: string;

  private constructor() {
    this.logger = LoggingService.getInstance();
    this.config = {
      host: '192.168.1.100', // Default host - should be configurable
      port: 5000, // Default port - should be configurable
      protocol: 'http'
    };
    this.serverUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  public setConfig(config: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...config };
    this.serverUrl = `${this.config.protocol}://${this.config.host}:${this.config.port}`;
    this.logger.info('Network configuration updated', this.config);
  }

  public async sendBarcodeData(barcodeData: string, format: string): Promise<boolean> {
    try {
      const payload = {
        type: "barcode",
        data: barcodeData,
        format: format,
        timestamp: Date.now() / 1000
      };

      const url = `${this.serverUrl}/barcode`;
      
      this.logger.info('Sending barcode data over network', { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      this.logger.info('Network transmission successful', result);
      return true;
    } catch (error) {
      this.logger.error('Network transmission failed', error);
      return false;
    }
  }

  /**
   * Send data to server
   * @param data Data to send
   * @returns Promise with send result
   */
  public async sendData(data: string): Promise<boolean> {
    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('Error sending data to server:', error);
      throw error;
    }
  }

  /**
   * Check server connection
   * @returns Promise with connection status
   */
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.serverUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('Error checking server connection:', error);
      throw error;
    }
  }

  /**
   * Set server URL
   * @param url New server URL
   */
  public setServerUrl(url: string): void {
    this.serverUrl = url;
  }

  public isNetworkAvailable(): boolean {
    return this.isConnected;
  }
}

export default NetworkService;