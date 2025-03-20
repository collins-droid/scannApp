import LoggingService from './LoggingService';
import USBService from './USBService';
import { USBEvent, ConnectionState } from './USBService';

/**
 * Command status enumeration
 */
export enum CommandStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  UNSUPPORTED = 'unsupported',
  PENDING = 'pending',
}

/**
 * Command result interface
 */
export interface CommandResult {
  status: CommandStatus;
  command: string;
  requestId: string;
  result?: any;
  error?: string;
  timestamp: string;
}

/**
 * Command service for handling desktop application commands
 */
export default class CommandService {
  private static instance: CommandService;
  private logger: LoggingService;
  private usbService: USBService;
  private supportedCommands: Map<string, (params: any) => Promise<any>> = new Map();
  private commandTimeout: number = 10000; // 10 seconds default timeout
  
  /**
   * Get the singleton instance of CommandService
   */
  public static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }
  
  /**
   * Initialize the command service
   */
  private constructor() {
    this.logger = LoggingService.getInstance();
    this.usbService = USBService.getInstance();
    
    // Register built-in commands
    this.registerBuiltInCommands();
    
    // Listen for connection state changes
    this.usbService.addEventListener(USBEvent.CONNECTION_STATE_CHANGE, this.handleConnectionStateChange.bind(this));
  }
  
  /**
   * Handle USB connection state changes
   * @param data Connection state data
   */
  private handleConnectionStateChange(data: any): void {
    if (data.state === ConnectionState.READY) {
      this.logger.info('USB connection ready, registering command capabilities');
      // Register command capabilities with desktop app
      this.sendCommandCapabilities();
    }
  }
  
  /**
   * Send command capabilities to desktop application
   */
  private async sendCommandCapabilities(): Promise<void> {
    try {
      const commands = Array.from(this.supportedCommands.keys());
      
      await this.usbService.sendCommand('registerCapabilities', {
        commands,
        version: '1.0.0',
      });
      
      this.logger.info('Command capabilities registered', { commands });
    } catch (error) {
      this.logger.error('Failed to register command capabilities', error);
    }
  }
  
  /**
   * Register built-in commands
   */
  private registerBuiltInCommands(): void {
    // Register device info command
    this.registerCommand('getDeviceInfo', async () => {
      return {
        manufacturer: 'Barcode Scanner App',
        model: 'Mobile Scanner',
        version: '1.0.0',
        platform: 'React Native',
        capabilities: ['scanning', 'batch', 'compression'],
      };
    });
    
    // Register ping command
    this.registerCommand('ping', async (params: any) => {
      return {
        timestamp: new Date().toISOString(),
        echo: params?.message || 'pong',
      };
    });
    
    // Register settings command
    this.registerCommand('getSettings', async () => {
      // In a real app, this would get actual settings from storage
      return {
        autoConnect: true,
        scanBeep: true,
        scanVibrate: true,
        batchSize: 10,
        useCompression: true,
      };
    });
    
    // Register update settings command
    this.registerCommand('updateSettings', async (params: any) => {
      // In a real app, this would update actual settings in storage
      this.logger.info('Received settings update', params);
      return {
        updated: true,
        settings: params,
      };
    });
  }
  
  /**
   * Register a new command handler
   * @param command Command name
   * @param handler Command handler function
   */
  public registerCommand(command: string, handler: (params: any) => Promise<any>): void {
    if (this.supportedCommands.has(command)) {
      this.logger.warn(`Command "${command}" is already registered and will be overwritten`);
    }
    
    this.supportedCommands.set(command, handler);
    this.logger.info(`Command "${command}" registered`);
    
    // If already connected, update capabilities
    if (this.usbService.getConnectionState() === ConnectionState.READY) {
      this.sendCommandCapabilities();
    }
  }
  
  /**
   * Unregister a command handler
   * @param command Command name
   * @returns Whether the command was unregistered
   */
  public unregisterCommand(command: string): boolean {
    const result = this.supportedCommands.delete(command);
    
    if (result) {
      this.logger.info(`Command "${command}" unregistered`);
      
      // If already connected, update capabilities
      if (this.usbService.getConnectionState() === ConnectionState.READY) {
        this.sendCommandCapabilities();
      }
    }
    
    return result;
  }
  
  /**
   * Execute a command from the desktop application
   * @param command Command name
   * @param params Command parameters
   * @param requestId Request ID for tracking
   * @returns Command result
   */
  public async executeCommand(command: string, params: any, requestId: string): Promise<CommandResult> {
    this.logger.info(`Executing command "${command}"`, { requestId, params });
    
    if (!this.supportedCommands.has(command)) {
      this.logger.warn(`Unsupported command "${command}" requested`, { requestId });
      
      return {
        status: CommandStatus.UNSUPPORTED,
        command,
        requestId,
        error: `Command "${command}" is not supported`,
        timestamp: new Date().toISOString(),
      };
    }
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        this.supportedCommands.get(command)!(params),
        this.commandTimeout
      );
      
      this.logger.info(`Command "${command}" executed successfully`, { requestId, result });
      
      return {
        status: CommandStatus.SUCCESS,
        command,
        requestId,
        result,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      let status = CommandStatus.ERROR;
      let errorMessage = error.message || 'Unknown error';
      
      if (error.name === 'TimeoutError') {
        status = CommandStatus.TIMEOUT;
        errorMessage = `Command "${command}" timed out after ${this.commandTimeout}ms`;
      }
      
      this.logger.error(`Command "${command}" execution failed`, { 
        requestId, 
        error,
        status
      });
      
      return {
        status,
        command,
        requestId,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }
  
  /**
   * Execute a function with timeout
   * @param promise Promise to execute
   * @param timeout Timeout in milliseconds
   * @returns Promise result
   */
  private async executeWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error('Command execution timed out');
        error.name = 'TimeoutError';
        reject(error);
      }, timeout);
    });
    
    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutId!);
    }
  }
  
  /**
   * Send a command to the desktop application
   * @param command Command name
   * @param params Command parameters
   * @returns Command result
   */
  public async sendCommand(command: string, params: any = {}): Promise<any> {
    if (this.usbService.getConnectionState() !== ConnectionState.READY) {
      throw new Error('Cannot send command, USB not connected');
    }
    
    try {
      this.logger.info(`Sending command "${command}" to desktop`, params);
      
      const result = await this.usbService.sendCommand(command, params);
      
      this.logger.info(`Command "${command}" response received`, result);
      
      return result;
    } catch (error) {
      this.logger.error(`Error sending command "${command}"`, error);
      throw error;
    }
  }
  
  /**
   * Set command timeout
   * @param timeout Timeout in milliseconds
   */
  public setCommandTimeout(timeout: number): void {
    if (timeout < 1000) {
      this.logger.warn(`Command timeout too short (${timeout}ms), minimum is 1000ms`);
      timeout = 1000;
    }
    
    this.commandTimeout = timeout;
    this.logger.info(`Command timeout set to ${timeout}ms`);
  }
  
  /**
   * Get command timeout
   * @returns Timeout in milliseconds
   */
  public getCommandTimeout(): number {
    return this.commandTimeout;
  }
  
  /**
   * Get list of supported commands
   * @returns Array of supported command names
   */
  public getSupportedCommands(): string[] {
    return Array.from(this.supportedCommands.keys());
  }
}