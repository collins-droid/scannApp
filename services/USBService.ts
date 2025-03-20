import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import LoggingService from './LoggingService';
import StorageService from './StorageService';
import USBCommunicationProtocol, { MessageType, Message } from './USBCommunicationProtocol';


const { USBModule } = NativeModules;

// Constants
const MAX_CONNECTION_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds
const CONNECTION_TIMEOUT = 15000; // 15 seconds

// Event types
export enum USBEvent {
  CONNECTED = 'usb_connected',
  DISCONNECTED = 'usb_disconnected',
  DATA_RECEIVED = 'usb_data_received',
  ERROR = 'usb_error',
  CONNECTION_STATE_CHANGE = 'usb_connection_state_change',
}

// Connection states
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  HANDSHAKING = 'handshaking', 
  READY = 'ready',
  ERROR = 'error',
}

// Connection error types
export enum ConnectionError {
  TIMEOUT = 'connection_timeout',
  DEVICE_NOT_FOUND = 'device_not_found',
  PERMISSION_DENIED = 'permission_denied',
  HANDSHAKE_FAILED = 'handshake_failed',
  DEVICE_DISCONNECTED = 'device_disconnected',
  UNKNOWN = 'unknown_error',
}

// Listener type
type USBListener = (data: any) => void;

/**
 * Service for managing USB connections and communication
 */
export default class USBService {
  private static instance: USBService;
  private logger: LoggingService;
  private storageService: StorageService;
  private protocol: USBCommunicationProtocol;
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Map<USBEvent, USBListener[]> = new Map();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private connectionError: ConnectionError | null = null;
  private connectionAttempts: number = 0;
  private connectionTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private deviceInfo: any = null;
  private autoReconnect: boolean = true;
  private isConnected: boolean = false; // Maintain backward compatibility

  /**
   * Initialize the USB service
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
    this.storageService = StorageService.getInstance();
    this.protocol = USBCommunicationProtocol.getInstance();
    
    // Initialize event emitter if on a real device
    if (Platform.OS !== 'web' && USBModule) {
      this.eventEmitter = new NativeEventEmitter(USBModule);
      this.setupNativeEventListeners();
    } else {
      this.logger.warn('USB Module not available on this platform');
    }
    
    // Load settings
    this.loadSettings();
    
    // Register message handlers
    this.setupMessageHandlers();
    
    this.logger.info('USB Service initialized');
  }

  /**
   * Get the singleton instance of USBService
   */
  public static getInstance(): USBService {
    if (!USBService.instance) {
      USBService.instance = new USBService();
    }
    return USBService.instance;
  }

  /**
   * Set up native event listeners
   */
  private setupNativeEventListeners(): void {
    if (!this.eventEmitter) return;
    
    // Device connection events
    this.eventEmitter.addListener('onDeviceConnected', (device) => {
      this.logger.info('USB device connected', device);
      this.deviceInfo = device;
      this.setConnectionState(ConnectionState.CONNECTED);
      this.connectionAttempts = 0;
      this.performHandshake();
      this.emitEvent(USBEvent.CONNECTED, device);
    });

    this.eventEmitter.addListener('onDeviceDisconnected', () => {
      this.logger.info('USB device disconnected');
      this.protocol.reset();
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.deviceInfo = null;
      this.emitEvent(USBEvent.DISCONNECTED, null);
      
      // Start reconnection if configured
      if (this.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    // Data events
    this.eventEmitter.addListener('onDataReceived', (data) => {
      this.logger.debug('USB data received', data);
      
      // Process through protocol
      if (data?.message) {
        this.protocol.processIncomingMessage(data.message);
      }
      
      // Emit raw data event for any listeners
      this.emitEvent(USBEvent.DATA_RECEIVED, data);
    });

    // Error events
    this.eventEmitter.addListener('onError', (error) => {
      this.logger.error('USB error', error);
      
      // Map native error to our error types
      let connectionError = ConnectionError.UNKNOWN;
      
      switch (error?.code) {
        case 'EACCES':
        case 'EPERM':
          connectionError = ConnectionError.PERMISSION_DENIED;
          break;
        case 'ENOENT':
        case 'ENODEV':
          connectionError = ConnectionError.DEVICE_NOT_FOUND;
          break;
        case 'ETIMEDOUT':
          connectionError = ConnectionError.TIMEOUT;
          break;
        case 'ENOTCONN':
          connectionError = ConnectionError.DEVICE_DISCONNECTED;
          break;
      }
      
      this.setConnectionState(ConnectionState.ERROR, connectionError);
      this.emitEvent(USBEvent.ERROR, { error, errorType: connectionError });
      
      // Retry connection if appropriate
      if (this.autoReconnect && 
          connectionError !== ConnectionError.PERMISSION_DENIED) {
        this.scheduleReconnect();
      }
    });
  }

  /**
   * Set up message handlers for the protocol
   */
  private setupMessageHandlers(): void {
    // Handle handshake responses
    this.protocol.registerHandler(MessageType.HANDSHAKE_RESPONSE, (message) => {
      this.logger.info('Handshake response received', message);
      this.setConnectionState(ConnectionState.READY);
    });
    
    // Handle status responses
    this.protocol.registerHandler(MessageType.STATUS_RESPONSE, (message) => {
      this.logger.info('Status response received', message);
      // Update device status information
      if (message.payload.deviceStatus) {
        this.deviceInfo = {
          ...this.deviceInfo,
          status: message.payload.deviceStatus
        };
      }
    });
    
    // Handle command responses
    this.protocol.registerHandler(MessageType.COMMAND_RESPONSE, (message) => {
      this.logger.info('Command response received', message);
      // Command responses are handled by the sendCommand method's promise
    });
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    try {
      const settings = await this.storageService.getItem('usb_settings');
      
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        this.autoReconnect = parsedSettings.autoReconnect ?? true;
      }
    } catch (error) {
      this.logger.error('Error loading USB settings', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      const settings = {
        autoReconnect: this.autoReconnect,
      };
      
      await this.storageService.setItem('usb_settings', JSON.stringify(settings));
    } catch (error) {
      this.logger.error('Error saving USB settings', error);
    }
  }

  /**
   * Update connection state and emit event
   * @param state New connection state
   * @param error Optional connection error
   */
  private setConnectionState(state: ConnectionState, error: ConnectionError | null = null): void {
    this.connectionState = state;
    this.connectionError = error;
    
    // Update isConnected for backward compatibility
    this.isConnected = (state === ConnectionState.READY);
    
    // Clear timers if now connected or in error state
    if (state === ConnectionState.READY || 
        state === ConnectionState.ERROR) {
      this.clearConnectionTimer();
    }
    
    // Emit state change event
    this.emitEvent(USBEvent.CONNECTION_STATE_CHANGE, { 
      state, 
      error,
      deviceInfo: this.deviceInfo,
    });
    
    // Emit connection change for backward compatibility
    this.emitEvent('connectionChange' as any, this.isConnected);
  }

  /**
   * Clear connection timeout timer
   */
  private clearConnectionTimer(): void {
    if (this.connectionTimer) {
      clearTimeout(this.connectionTimer);
      this.connectionTimer = null;
    }
  }
  
  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Schedule reconnect with increasing delay based on attempts
    const delay = RETRY_DELAY * Math.pow(1.5, Math.min(this.connectionAttempts, 5));
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
    
    this.logger.info(`Reconnection scheduled in ${delay}ms (attempt ${this.connectionAttempts + 1})`);
  }

  /**
   * Emit an event to all registered listeners
   * @param event Event type
   * @param data Event data
   */
  private emitEvent(event: USBEvent | string, data: any): void {
    // Handle both new enum-based events and legacy string events
    const eventKey = event.toString();
    const eventListeners = this.listeners.get(eventKey as any) || [];
    
    for (const listener of eventListeners) {
      try {
        listener(data);
      } catch (error: any) {
        this.logger.error(`Error in USB event listener for ${eventKey}`, error);
      }
    }
  }

  /**
   * Perform handshake with desktop application
   */
  private async performHandshake(): Promise<void> {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      this.logger.warn('Cannot perform handshake, not connected');
      return;
    }
    
    this.setConnectionState(ConnectionState.HANDSHAKING);
    
    try {
      // App info from settings
      const appInfo = {
        appName: 'BarcodeScanner',
        version: '1.0.0', // TODO: Get from app config
      };
      
      // Create send function for protocol
      const sendFunction = async (data: string): Promise<boolean> => {
        try {
          if (USBModule?.sendData) {
            await USBModule.sendData(data);
            return true;
          }
          
          // Fallback for mock implementation
          console.log('Sending data over USB (mock):', data);
          
          // Simulate response for mock mode
          if (process.env.NODE_ENV === 'development') {
            setTimeout(() => {
              const responseMessage = this.protocol.createMessage(MessageType.HANDSHAKE_RESPONSE, {
                sessionId: `session-${Date.now()}`,
                deviceInfo: {
                  name: 'Mock USB Device',
                  id: 'mock-device-001',
                  firmwareVersion: '1.0.0',
                  capabilities: ['BATCH_PROCESSING', 'COMPRESSION']
                }
              });
              this.protocol.processIncomingMessage(JSON.stringify(responseMessage));
            }, 500);
          }
          
          return true;
        } catch (error) {
          this.logger.error('Error sending handshake data', error);
          return false;
        }
      };
      
      // Perform handshake
      await this.protocol.performHandshake(sendFunction, appInfo);
      
      // If we get here, handshake was successful
      this.setConnectionState(ConnectionState.READY);
    } catch (error) {
      this.logger.error('Handshake failed', error);
      this.setConnectionState(ConnectionState.ERROR, ConnectionError.HANDSHAKE_FAILED);
      
      // Retry if appropriate
      if (this.connectionAttempts < MAX_CONNECTION_RETRIES && this.autoReconnect) {
        this.connectionAttempts++;
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Connect to USB device
   * @returns Promise indicating connection success
   */
  public async connect(): Promise<boolean> {
    if (this.connectionState === ConnectionState.CONNECTING) {
      this.logger.info('Connection attempt already in progress');
      return false;
    }
    
    if (this.connectionState === ConnectionState.READY) {
      this.logger.info('Already connected');
      return true;
    }
    
    this.clearConnectionTimer();
    this.setConnectionState(ConnectionState.CONNECTING);
    
    // Set connection timeout
    this.connectionTimer = setTimeout(() => {
      if (this.connectionState === ConnectionState.CONNECTING) {
        this.logger.warn('Connection attempt timed out');
        this.setConnectionState(ConnectionState.ERROR, ConnectionError.TIMEOUT);
        
        // Retry if appropriate
        if (this.connectionAttempts < MAX_CONNECTION_RETRIES && this.autoReconnect) {
          this.connectionAttempts++;
          this.scheduleReconnect();
        }
      }
    }, CONNECTION_TIMEOUT);
    
    try {
      this.logger.info('Attempting to connect to USB device');
      
      if (USBModule?.connectDevice) {
        await USBModule.connectDevice();
        // Connection will be handled by event listeners
        return true;
      } else {
        // Mock implementation for development
        setTimeout(() => {
          this.deviceInfo = { 
            name: 'Mock USB Device',
            id: 'mock-device-001',
            type: 'virtual' 
          };
          this.setConnectionState(ConnectionState.CONNECTED);
          this.performHandshake();
          this.emitEvent(USBEvent.CONNECTED, this.deviceInfo);
        }, 1000);
        return true;
      }
      
    } catch (error) {
      this.logger.error('Error connecting to USB device', error);
      
      // Determine error type
      let connectionError = ConnectionError.UNKNOWN;
      
      if (error.message?.includes('permission')) {
        connectionError = ConnectionError.PERMISSION_DENIED;
      } else if (error.message?.includes('not found') || error.message?.includes('no device')) {
        connectionError = ConnectionError.DEVICE_NOT_FOUND;
      }
      
      this.setConnectionState(ConnectionState.ERROR, connectionError);
      
      // Retry if appropriate
      if (this.connectionAttempts < MAX_CONNECTION_RETRIES && 
          this.autoReconnect && 
          connectionError !== ConnectionError.PERMISSION_DENIED) {
        this.connectionAttempts++;
        this.scheduleReconnect();
      }
      
      return false;
    }
  }

  /**
   * Disconnect from USB device
   */
  public async disconnect(): Promise<void> {
    this.clearConnectionTimer();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      this.logger.info('Already disconnected');
      return;
    }
    
    try {
      this.logger.info('Disconnecting from USB device');
      
      if (USBModule?.disconnectDevice) {
        await USBModule.disconnectDevice();
        // Disconnection will be handled by event listeners
      } else {
        // Mock implementation for development
        this.protocol.reset();
        this.setConnectionState(ConnectionState.DISCONNECTED);
        this.deviceInfo = null;
        this.emitEvent(USBEvent.DISCONNECTED, null);
      }
      
    } catch (error) {
      this.logger.error('Error disconnecting from USB device', error);
      
      // Force disconnect state even if native call failed
      this.protocol.reset();
      this.setConnectionState(ConnectionState.DISCONNECTED);
      this.deviceInfo = null;
    }
  }

  /**
   * Check if connected to USB device
   * @returns Connection status
   */
  public isDeviceConnected(): boolean {
    return this.connectionState === ConnectionState.READY;
  }

  /**
   * Send data to the USB device
   * @param data Data to send
   * @param waitForAck Whether to wait for acknowledgment
   * @returns Promise indicating send success
   */
  public async sendData(data: string, waitForAck: boolean = true): Promise<any> {
    if (this.connectionState !== ConnectionState.READY) {
      if (USBModule?.sendData) {
        throw new Error(`Cannot send data, connection not ready (state: ${this.connectionState})`);
      } else {
        // For backward compatibility in mock mode
        console.log('Sending data over USB (mock):', data);
        this.emitEvent('dataSent' as any, data);
        return true;
      }
    }
    
    try {
      if (waitForAck) {
        // Create message
        const message = this.protocol.createMessage(MessageType.DATA, {
          content: data,
        });
        
        // Send with acknowledgment
        const sendFunction = async (msgData: string): Promise<boolean> => {
          if (USBModule?.sendData) {
            await USBModule.sendData(msgData);
          } else {
            // Mock implementation
            console.log('Sending data over USB (mock):', msgData);
            this.emitEvent('dataSent' as any, data);
            
            // Simulate ACK response
            setTimeout(() => {
              const ackMessage = this.protocol.createMessage(MessageType.ACK, {
                originalMessageId: message.id,
                status: 'success'
              });
              this.protocol.processIncomingMessage(JSON.stringify(ackMessage));
            }, 300);
          }
          return true;
        };
        
        // Return result from acknowledgment
        return await this.protocol.sendWithAcknowledgment(message, sendFunction);
      } else {
        // Simple send without waiting for ack
        if (USBModule?.sendData) {
          await USBModule.sendData(data);
        } else {
          // Mock implementation
          console.log('Sending data over USB (mock):', data);
          this.emitEvent('dataSent' as any, data);
        }
        return true;
      }
    } catch (error) {
      this.logger.error('Error sending data', error);
      throw error;
    }
  }
  
  /**
   * Send batch data to USB device
   * @param batchData Array of data items to send
   * @param batchId Optional batch ID
   * @returns Promise resolving with acknowledgment data
   */
  public async sendBatchData(batchData: any[], batchId?: string): Promise<any> {
    if (this.connectionState !== ConnectionState.READY) {
      throw new Error(`Cannot send batch data, connection not ready (state: ${this.connectionState})`);
    }
    
    try {
      // Create batch message
      const batchMessage = this.protocol.createMessage(MessageType.BATCH_DATA, {
        batchId: batchId || `batch-${Date.now()}`,
        itemCount: batchData.length,
        items: batchData,
      });
      
      // Send with acknowledgment
      const sendFunction = async (data: string): Promise<boolean> => {
        if (USBModule?.sendData) {
          await USBModule.sendData(data);
        } else {
          // Mock implementation
          console.log('Sending batch data over USB (mock):', data);
          
          // Simulate ACK response
          setTimeout(() => {
            const ackMessage = this.protocol.createMessage(MessageType.ACK, {
              originalMessageId: batchMessage.id,
              status: 'success',
              itemsReceived: batchData.length
            });
            this.protocol.processIncomingMessage(JSON.stringify(ackMessage));
          }, 500);
        }
        return true;
      };
      
      // Return result from acknowledgment
      return await this.protocol.sendWithAcknowledgment(batchMessage, sendFunction);
    } catch (error) {
      this.logger.error('Error sending batch data', error);
      throw error;
    }
  }

  /**
   * Send command to USB device
   * @param command Command to send
   * @param params Command parameters
   * @returns Promise resolving with command response
   */
  public async sendCommand(command: string, params: any = {}): Promise<any> {
    if (this.connectionState !== ConnectionState.READY) {
      throw new Error(`Cannot send command, connection not ready (state: ${this.connectionState})`);
    }
    
    try {
      // Create command message
      const commandMessage = this.protocol.createMessage(MessageType.COMMAND, {
        command,
        params,
      });
      
      // Send with acknowledgment
      const sendFunction = async (data: string): Promise<boolean> => {
        if (USBModule?.sendData) {
          await USBModule.sendData(data);
        } else {
          // Mock implementation
          console.log('Sending command over USB (mock):', data);
          
          // Simulate response
          setTimeout(() => {
            const responseMessage = this.protocol.createMessage(MessageType.COMMAND_RESPONSE, {
              originalMessageId: commandMessage.id,
              command,
              status: 'success',
              result: { executed: true }
            });
            this.protocol.processIncomingMessage(JSON.stringify(responseMessage));
          }, 400);
        }
        return true;
      };
      
      // Return result from acknowledgment
      return await this.protocol.sendWithAcknowledgment(commandMessage, sendFunction);
    } catch (error) {
      this.logger.error(`Error sending command: ${command}`, error);
      throw error;
    }
  }

  /**
   * Request device status
   * @returns Promise resolving with device status
   */
  public async requestStatus(): Promise<any> {
    if (this.connectionState !== ConnectionState.READY) {
      throw new Error(`Cannot request status, connection not ready (state: ${this.connectionState})`);
    }
    
    try {
      // Create status request message
      const statusMessage = this.protocol.createMessage(MessageType.STATUS_REQUEST);
      
      // Send with acknowledgment
      const sendFunction = async (data: string): Promise<boolean> => {
        if (USBModule?.sendData) {
          await USBModule.sendData(data);
        } else {
          // Mock implementation
          console.log('Sending status request over USB (mock):', data);
          
          // Simulate response
          setTimeout(() => {
            const responseMessage = this.protocol.createMessage(MessageType.STATUS_RESPONSE, {
              originalMessageId: statusMessage.id,
              deviceStatus: {
                batteryLevel: 85,
                memoryUsage: 42,
                firmwareVersion: '1.2.3',
                isCharging: true
              }
            });
            this.protocol.processIncomingMessage(JSON.stringify(responseMessage));
          }, 300);
        }
        return true;
      };
      
      // Return result from acknowledgment
      return await this.protocol.sendWithAcknowledgment(statusMessage, sendFunction);
    } catch (error) {
      this.logger.error('Error requesting status', error);
      throw error;
    }
  }

  /**
   * Register event listener
   * @param event Event type or name
   * @param listener Listener function
   */
  public addEventListener(event: USBEvent | string, listener: USBListener): void {
    const eventKey = event.toString();
    
    if (!this.listeners.has(eventKey as any)) {
      this.listeners.set(eventKey as any, []);
    }
    
    this.listeners.get(eventKey as any)?.push(listener);
  }

  /**
   * Remove event listener
   * @param event Event type or name
   * @param listener Listener function to remove
   */
  public removeEventListener(event: USBEvent | string, listener: USBListener): void {
    const eventKey = event.toString();
    
    if (!this.listeners.has(eventKey as any)) {
      return;
    }
    
    const listeners = this.listeners.get(eventKey as any) || [];
    const index = listeners.indexOf(listener);
    
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * Set auto-reconnect setting
   * @param enabled Whether to automatically reconnect
   */
  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
    this.saveSettings();
  }

  /**
   * Get current connection state
   * @returns Connection state
   */
  public getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get connected device info
   * @returns Device info or null if not connected
   */
  public getDeviceInfo(): any {
    return this.deviceInfo;
  }

  /**
   * Get whether handshake is complete
   * @returns True if handshake is complete
   */
  public isHandshakeComplete(): boolean {
    return this.protocol.isHandshakeCompleted();
  }

  /**
   * Get current session ID
   * @returns Session ID or null if not in session
   */
  public getSessionId(): string | null {
    return this.protocol.getSessionId();
  }
} 