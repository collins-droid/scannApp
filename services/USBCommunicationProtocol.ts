import LoggingService from './LoggingService';

/**
 * Message type enumeration
 */
export enum MessageType {
  // Handshake messages
  HANDSHAKE_REQUEST = 'HANDSHAKE_REQUEST',
  HANDSHAKE_RESPONSE = 'HANDSHAKE_RESPONSE',
  
  // Data messages
  DATA = 'DATA',
  BATCH_DATA = 'BATCH_DATA',
  
  // Acknowledgment messages
  ACK = 'ACK',
  NACK = 'NACK',
  
  // Command messages
  COMMAND = 'COMMAND',
  COMMAND_RESPONSE = 'COMMAND_RESPONSE',
  
  // Status messages
  STATUS_REQUEST = 'STATUS_REQUEST',
  STATUS_RESPONSE = 'STATUS_RESPONSE',
  
  // Error messages
  ERROR = 'ERROR',
}

/**
 * Message interface
 */
export interface Message {
  type: MessageType;
  id: string;
  timestamp: string;
  payload: any;
}

/**
 * Communication protocol service for desktop application integration
 */
export default class USBCommunicationProtocol {
  private static instance: USBCommunicationProtocol;
  private logger: LoggingService;
  private messageHandlers: Map<MessageType, ((message: Message) => void)[]> = new Map();
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timestamp: Date }> = new Map();
  private isHandshakeComplete: boolean = false;
  private sessionId: string | null = null;
  private deviceInfo: any = null;
  private messageTimeout: number = 30000; // 30 seconds for development

  /**
   * Initialize the protocol
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
    
    // Start the timeout checker
    setInterval(() => this.checkTimeouts(), 5000);
  }

  /**
   * Get the singleton instance of USBCommunicationProtocol
   */
  public static getInstance(): USBCommunicationProtocol {
    if (!USBCommunicationProtocol.instance) {
      USBCommunicationProtocol.instance = new USBCommunicationProtocol();
    }
    return USBCommunicationProtocol.instance;
  }

  /**
   * Check for message timeouts
   */
  private checkTimeouts(): void {
    const now = new Date();
    const timeoutIds: string[] = [];
    
    this.pendingMessages.forEach((data, id) => {
      const elapsedTime = now.getTime() - data.timestamp.getTime();
      
      if (elapsedTime > this.messageTimeout) {
        timeoutIds.push(id);
      }
    });
    
    // Handle timeouts
    timeoutIds.forEach(id => {
      const pendingMessage = this.pendingMessages.get(id);
      
      if (pendingMessage) {
        const { reject } = pendingMessage;
        reject(new Error(`Message timeout: ${id}`));
        this.pendingMessages.delete(id);
        this.logger.warn(`Message timeout: ${id}`);
      }
    });
  }

  /**
   * Register a message handler
   * @param type Message type to handle
   * @param handler Handler function
   */
  public registerHandler(type: MessageType, handler: (message: Message) => void): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    
    this.messageHandlers.get(type)?.push(handler);
  }

  /**
   * Unregister a message handler
   * @param type Message type
   * @param handler Handler function to remove
   */
  public unregisterHandler(type: MessageType, handler: (message: Message) => void): void {
    if (!this.messageHandlers.has(type)) {
      return;
    }
    
    const handlers = this.messageHandlers.get(type) || [];
    const index = handlers.indexOf(handler);
    
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Process an incoming message
   * @param data Message data
   */
  public processIncomingMessage(data: string): void {
    try {
      // Parse message
      const message = JSON.parse(data) as Message;
      
      // Log message received
      this.logger.info(`Received message: ${message.type} (ID: ${message.id})`);
      
      // Handle pending message resolution
      if (message.type === MessageType.ACK || message.type === MessageType.NACK) {
        const originalMessageId = message.payload.originalMessageId;
        const pendingMessage = this.pendingMessages.get(originalMessageId);
        
        if (pendingMessage) {
          const { resolve, reject } = pendingMessage;
          
          if (message.type === MessageType.ACK) {
            resolve(message.payload);
          } else {
            reject(new Error(message.payload.errorMessage || 'Message not acknowledged'));
          }
          
          this.pendingMessages.delete(originalMessageId);
        }
      }
      
      // Update handshake status
      if (message.type === MessageType.HANDSHAKE_RESPONSE) {
        this.isHandshakeComplete = true;
        this.sessionId = message.payload.sessionId;
        this.deviceInfo = message.payload.deviceInfo;
      }
      
      // Call registered handlers
      const handlers = this.messageHandlers.get(message.type) || [];
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          this.logger.error(`Error in message handler for ${message.type}`, error);
        }
      });
    } catch (error) {
      this.logger.error('Error processing incoming message', error);
    }
  }

  /**
   * Create a message
   * @param type Message type
   * @param payload Message payload
   * @returns Formatted message
   */
  public createMessage(type: MessageType, payload: any = {}): Message {
    return {
      type,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      payload,
    };
  }

  /**
   * Format a message for transmission
   * @param message Message to format
   * @returns Formatted message string
   */
  public formatMessage(message: Message): string {
    return JSON.stringify(message);
  }

  /**
   * Send a message and wait for acknowledgment
   * @param message Message to send
   * @param sendFunction Function to send the data
   * @returns Promise that resolves with the acknowledgment payload
   */
  public sendWithAcknowledgment(
    message: Message, 
    sendFunction: (data: string) => Promise<boolean>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Format message
      const formattedMessage = this.formatMessage(message);
      
      // Store pending message
      this.pendingMessages.set(message.id, {
        resolve,
        reject,
        timestamp: new Date(),
      });
      
      // Send message
      sendFunction(formattedMessage)
        .then(success => {
          if (!success) {
            this.pendingMessages.delete(message.id);
            reject(new Error('Failed to send message'));
          }
          
          this.logger.info(`Sent message: ${message.type} (ID: ${message.id})`);
        })
        .catch(error => {
          this.pendingMessages.delete(message.id);
          reject(error);
        });
    });
  }

  /**
   * Perform handshake with desktop application
   * @param sendFunction Function to send the data
   * @param appInfo Application information to include in handshake
   * @returns Promise that resolves when handshake is complete
   */
  public async performHandshake(
    sendFunction: (data: string) => Promise<boolean>,
    appInfo: { appName: string; version: string }
  ): Promise<any> {
    // Reset handshake status
    this.isHandshakeComplete = false;
    this.sessionId = null;
    this.deviceInfo = null;
    
    // Create handshake request
    const handshakeRequest = this.createMessage(MessageType.HANDSHAKE_REQUEST, {
      appInfo,
      capabilities: [
        'BATCH_PROCESSING',
        'COMPRESSION',
        'DATA_VALIDATION',
        'COMMAND_SUPPORT',
      ],
    });
    
    // Send and wait for response
    try {
      const response = await this.sendWithAcknowledgment(handshakeRequest, sendFunction);
      
      this.logger.info('Handshake completed successfully');
      
      return {
        sessionId: this.sessionId,
        deviceInfo: this.deviceInfo,
      };
    } catch (error) {
      this.logger.error('Handshake failed', error);
      throw error;
    }
  }

  /**
   * Check if handshake is complete
   * @returns True if handshake is complete
   */
  public isHandshakeCompleted(): boolean {
    return this.isHandshakeComplete;
  }

  /**
   * Get the current session ID
   * @returns Session ID or null if not connected
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Get connected device information
   * @returns Device information or null if not connected
   */
  public getDeviceInfo(): any | null {
    return this.deviceInfo;
  }

  /**
   * Reset protocol state
   */
  public reset(): void {
    this.isHandshakeComplete = false;
    this.sessionId = null;
    this.deviceInfo = null;
    this.pendingMessages.clear();
  }
} 