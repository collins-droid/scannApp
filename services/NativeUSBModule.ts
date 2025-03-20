import { NativeModules, NativeEventEmitter, EmitterSubscription, Platform } from 'react-native';

// Define the interface for the native module
interface NativeUSBModuleInterface {
  getDeviceList(): Promise<USBDevice[]>;
  requestPermission(deviceId: number): Promise<boolean>;
  connectToDevice(deviceId: number): Promise<boolean>;
  disconnect(): Promise<boolean>;
  sendData(data: string): Promise<boolean>;
  isConnected(): Promise<boolean>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
}

// Define the USB device interface
export interface USBDevice {
  deviceId: number;
  deviceName: string;
  vendorId: number;
  productId: number;
}

// Get the native module
const { USBModule } = NativeModules as { USBModule: NativeUSBModuleInterface };

// Create event emitter for the native module
const usbEventEmitter = USBModule ? new NativeEventEmitter(USBModule as any) : null;

// Event types
export enum USBEventType {
  PERMISSION = 'usbPermission',
  CONNECTED = 'usbConnected',
  DISCONNECTED = 'usbDisconnected',
  DATA_SENT = 'usbDataSent',
  ATTACHED = 'usbAttached',
  DETACHED = 'usbDetached',
}

/**
 * Class for interacting with the native USB module
 */
export default class NativeUSBModule {
  private static instance: NativeUSBModule;
  private listeners: Map<string, EmitterSubscription> = new Map();

  /**
   * Get the singleton instance of NativeUSBModule
   */
  public static getInstance(): NativeUSBModule {
    if (!NativeUSBModule.instance) {
      NativeUSBModule.instance = new NativeUSBModule();
    }
    return NativeUSBModule.instance;
  }

  /**
   * Get a list of connected USB devices
   * @returns Promise with device list
   */
  public async getDeviceList(): Promise<USBDevice[]> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.getDeviceList();
    } catch (error) {
      console.error('Error getting USB device list:', error);
      throw error;
    }
  }

  /**
   * Request permission to access USB device
   * @param deviceId Device ID to request permission for
   * @returns Promise with permission result
   */
  public async requestPermission(deviceId: number): Promise<boolean> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.requestPermission(deviceId);
    } catch (error) {
      console.error('Error requesting USB permission:', error);
      throw error;
    }
  }

  /**
   * Connect to USB device
   * @param deviceId Device ID to connect to
   * @returns Promise with connection result
   */
  public async connectToDevice(deviceId: number): Promise<boolean> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.connectToDevice(deviceId);
    } catch (error) {
      console.error('Error connecting to USB device:', error);
      throw error;
    }
  }

  /**
   * Disconnect from USB device
   * @returns Promise with disconnection result
   */
  public async disconnect(): Promise<boolean> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.disconnect();
    } catch (error) {
      console.error('Error disconnecting from USB device:', error);
      throw error;
    }
  }

  /**
   * Send data over USB connection
   * @param data Data to send
   * @returns Promise with send result
   */
  public async sendData(data: string): Promise<boolean> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.sendData(data);
    } catch (error) {
      console.error('Error sending data to USB device:', error);
      throw error;
    }
  }

  /**
   * Check if connected to USB device
   * @returns Promise with connection status
   */
  public async isConnected(): Promise<boolean> {
    if (!USBModule) {
      throw new Error('USB Module not available');
    }

    try {
      return await USBModule.isConnected();
    } catch (error) {
      console.error('Error checking USB connection status:', error);
      throw error;
    }
  }

  /**
   * Add event listener
   * @param eventType Event type
   * @param listener Callback function
   * @returns Subscription that can be used to remove the listener
   */
  public addListener(eventType: USBEventType, listener: (event: any) => void): EmitterSubscription | null {
    if (!usbEventEmitter) {
      console.warn('USB Event Emitter not available');
      return null;
    }

    const subscription = usbEventEmitter.addListener(eventType, listener);
    this.listeners.set(`${eventType}-${listener}`, subscription);
    return subscription;
  }

  /**
   * Remove event listener
   * @param eventType Event type
   * @param listener Callback function
   */
  public removeListener(eventType: USBEventType, listener: (event: any) => void): void {
    if (!usbEventEmitter) {
      return;
    }

    const key = `${eventType}-${listener}`;
    const subscription = this.listeners.get(key);
    
    if (subscription) {
      subscription.remove();
      this.listeners.delete(key);
    }
  }

  /**
   * Remove all event listeners
   */
  public removeAllListeners(): void {
    if (!usbEventEmitter) {
      return;
    }

    this.listeners.forEach(subscription => subscription.remove());
    this.listeners.clear();
  }
} 